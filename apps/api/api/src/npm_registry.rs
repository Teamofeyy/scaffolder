use crate::schema::DependencySearchResult;
use color_eyre::Result;
use serde::Deserialize;
use std::{
    collections::HashMap,
    env,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

const SEARCH_CACHE_TTL: Duration = Duration::from_secs(300);
const DEFAULT_SEARCH_CACHE_MAX_ENTRIES: usize = 256;
const DEFAULT_SEARCH_CACHE_MAX_BYTES: usize = 4 * 1024 * 1024;
const MAX_NPM_RESPONSE_BYTES: usize = 1024 * 1024;
const NPM_REQUEST_TIMEOUT: Duration = Duration::from_secs(5);

type SearchCache = Mutex<HashMap<String, (Instant, Vec<DependencySearchResult>)>>;

static SEARCH_CACHE: OnceLock<SearchCache> = OnceLock::new();
static SEARCH_CACHE_MAX_ENTRIES: OnceLock<usize> = OnceLock::new();
static SEARCH_CACHE_MAX_BYTES: OnceLock<usize> = OnceLock::new();
static NPM_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[derive(Debug, Deserialize)]
struct NpmSearchResponse {
    objects: Vec<NpmSearchObject>,
}

#[derive(Debug, Deserialize)]
struct NpmSearchObject {
    package: NpmPackage,
}

#[derive(Debug, Deserialize)]
struct NpmPackage {
    name: String,
    version: String,
    description: Option<String>,
}

pub async fn search_dependencies(query: &str, limit: usize) -> Result<Vec<DependencySearchResult>> {
    let limit = limit.clamp(1, 20);
    let normalized_query = query.trim().to_lowercase();
    let cache_key = format!("{normalized_query}:{limit}");

    if let Some(cached) = cached_search_result(&cache_key) {
        return Ok(cached);
    }

    let response = npm_client()?
        .get("https://registry.npmjs.org/-/v1/search")
        .query(&[
            ("text", normalized_query.as_str()),
            ("size", &limit.to_string()),
            ("popularity", "0.65"),
            ("quality", "0.25"),
            ("maintenance", "0.10"),
        ])
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;
    if response.len() > MAX_NPM_RESPONSE_BYTES {
        color_eyre::eyre::bail!("npm registry response exceeds the size limit");
    }
    let response = serde_json::from_slice::<NpmSearchResponse>(&response)?;

    let results = response
        .objects
        .into_iter()
        .map(|item| DependencySearchResult {
            name: item.package.name,
            version: item.package.version,
            description: item.package.description,
        })
        .collect::<Vec<_>>();

    cache_search_result(cache_key, results.clone());
    Ok(results)
}

fn cached_search_result(cache_key: &str) -> Option<Vec<DependencySearchResult>> {
    let cache = SEARCH_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let Ok(mut cache) = cache.lock() else {
        return None;
    };

    let (stored_at, results) = cache.get(cache_key)?;

    if stored_at.elapsed() <= SEARCH_CACHE_TTL {
        return Some(results.clone());
    }

    cache.remove(cache_key);
    None
}

fn cache_search_result(cache_key: String, results: Vec<DependencySearchResult>) {
    let cache = SEARCH_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let Ok(mut cache) = cache.lock() else {
        return;
    };

    cache.retain(|_, (stored_at, _)| stored_at.elapsed() <= SEARCH_CACHE_TTL);
    let max_entries = *SEARCH_CACHE_MAX_ENTRIES.get_or_init(|| {
        env::var("NPM_SEARCH_CACHE_MAX_ENTRIES")
            .ok()
            .and_then(|value| value.parse().ok())
            .filter(|value| *value > 0)
            .unwrap_or(DEFAULT_SEARCH_CACHE_MAX_ENTRIES)
    });
    let max_bytes = *SEARCH_CACHE_MAX_BYTES.get_or_init(|| {
        env::var("NPM_SEARCH_CACHE_MAX_BYTES")
            .ok()
            .and_then(|value| value.parse().ok())
            .filter(|value| *value > 0)
            .unwrap_or(DEFAULT_SEARCH_CACHE_MAX_BYTES)
    });
    let new_entry_bytes = cache_entry_bytes(&cache_key, &results);
    if new_entry_bytes > max_bytes {
        return;
    }

    cache.remove(&cache_key);

    while cache.len() >= max_entries
        || cache
            .iter()
            .map(|(key, (_, results))| cache_entry_bytes(key, results))
            .sum::<usize>()
            .saturating_add(new_entry_bytes)
            > max_bytes
    {
        let Some(oldest_key) = cache
            .iter()
            .min_by_key(|(_, (stored_at, _))| *stored_at)
            .map(|(key, _)| key.clone())
        else {
            break;
        };
        cache.remove(&oldest_key);
    }

    cache.insert(cache_key, (Instant::now(), results));
}

fn cache_entry_bytes(cache_key: &str, results: &[DependencySearchResult]) -> usize {
    cache_key.len()
        + results
            .iter()
            .map(|result| {
                result.name.len()
                    + result.version.len()
                    + result
                        .description
                        .as_deref()
                        .map(str::len)
                        .unwrap_or_default()
            })
            .sum::<usize>()
}

fn npm_client() -> Result<&'static reqwest::Client> {
    if let Some(client) = NPM_CLIENT.get() {
        return Ok(client);
    }

    let client = reqwest::Client::builder()
        .timeout(NPM_REQUEST_TIMEOUT)
        .build()?;
    Ok(NPM_CLIENT.get_or_init(|| client))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_prunes_expired_entries() {
        let cache = SEARCH_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        cache.lock().expect("cache").insert(
            "expired".to_owned(),
            (
                Instant::now() - SEARCH_CACHE_TTL - Duration::from_secs(1),
                Vec::new(),
            ),
        );

        cache_search_result("fresh".to_owned(), Vec::new());

        let cache = cache.lock().expect("cache");
        assert!(!cache.contains_key("expired"));
        assert!(cache.contains_key("fresh"));
    }
}
