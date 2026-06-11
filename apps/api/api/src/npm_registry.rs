use crate::schema::DependencySearchResult;
use color_eyre::Result;
use serde::Deserialize;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

const SEARCH_CACHE_TTL: Duration = Duration::from_secs(300);

type SearchCache = Mutex<HashMap<String, (Instant, Vec<DependencySearchResult>)>>;

static SEARCH_CACHE: OnceLock<SearchCache> = OnceLock::new();

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

    let response = reqwest::Client::new()
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
        .json::<NpmSearchResponse>()
        .await?;

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

    cache.insert(cache_key, (Instant::now(), results));
}
