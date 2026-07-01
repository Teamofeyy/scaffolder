use std::collections::{HashMap, HashSet};

use crate::schema::{
    Feature, Framework, Linting, PackageManager, ProjectConfig, Routing, StateManagement, Styling,
    feature_registry,
};

#[derive(Debug, Clone)]
pub struct ResolvedPlan {
    pub selected: Vec<Feature>,
    pub ordered: Vec<Feature>,
}

#[derive(Debug)]
pub enum ResolverError {
    UnknownFeatureMetadata(Feature),
    Conflict { left: Feature, right: Feature },
    CyclicDependency(Feature),
}

impl std::fmt::Display for ResolverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownFeatureMetadata(feature) => {
                write!(f, "feature metadata is missing for {feature:?}")
            }
            Self::Conflict { left, right } => {
                write!(f, "feature {left:?} conflicts with {right:?}")
            }
            Self::CyclicDependency(feature) => {
                write!(f, "cyclic dependency detected at {feature:?}")
            }
        }
    }
}

impl std::error::Error for ResolverError {}

pub fn resolve_from_config(config: &ProjectConfig) -> Result<ResolvedPlan, ResolverError> {
    let mut selected = initial_features(config);
    selected = close_requires(&selected)?;
    validate_conflicts(&selected)?;
    let ordered = topo_sort(&selected)?;

    Ok(ResolvedPlan { selected, ordered })
}

fn initial_features(config: &ProjectConfig) -> Vec<Feature> {
    let mut features = vec![
        framework_to_feature(&config.framework),
        package_manager_to_feature(&config.package_manager),
    ];

    match config.styling {
        Styling::Tailwind => features.push(Feature::Tailwind),
        Styling::CssModules => features.push(Feature::CssModules),
        Styling::StyledComponents => features.push(Feature::StyledComponents),
    }

    match config.linting {
        Linting::Eslint => features.push(Feature::Eslint),
        Linting::Biome => features.push(Feature::Biome),
        Linting::None => {}
    }

    match config.state_management {
        StateManagement::Zustand => features.push(Feature::Zustand),
        StateManagement::Redux => features.push(Feature::Redux),
        StateManagement::Jotai => features.push(Feature::Jotai),
        StateManagement::None => {}
    }

    match config.routing {
        Routing::ReactRouter | Routing::ReactRouterData => features.push(Feature::ReactRouter),
        Routing::VueRouter => features.push(Feature::VueRouter),
        Routing::AppRouter | Routing::PagesRouter | Routing::None => {}
    }

    dedup(features)
}

fn framework_to_feature(framework: &Framework) -> Feature {
    match framework {
        Framework::React => Feature::React,
        Framework::Nextjs => Feature::Nextjs,
        Framework::AngularTs => Feature::AngularTs,
        Framework::EmberTs => Feature::EmberTs,
        Framework::LitTs => Feature::LitTs,
        Framework::MarkoTs => Feature::MarkoTs,
        Framework::NuxtTs => Feature::NuxtTs,
        Framework::PreactTs => Feature::PreactTs,
        Framework::PreactTsOfficial => Feature::PreactTsOfficial,
        Framework::QwikTs => Feature::QwikTs,
        Framework::ReactTs => Feature::ReactTs,
        Framework::SolidTs => Feature::SolidTs,
        Framework::SvelteTs => Feature::SvelteTs,
        Framework::VueTs => Feature::VueTs,
        Framework::Vue => Feature::Vue,
    }
}

fn package_manager_to_feature(manager: &PackageManager) -> Feature {
    match manager {
        PackageManager::Npm => Feature::Npm,
        PackageManager::Pnpm => Feature::Pnpm,
    }
}

fn close_requires(seed: &[Feature]) -> Result<Vec<Feature>, ResolverError> {
    let registry = feature_registry();
    let mut result = seed.to_vec();
    let mut idx = 0;

    while idx < result.len() {
        let feature = result[idx].clone();
        let meta = registry
            .get(&feature)
            .ok_or_else(|| ResolverError::UnknownFeatureMetadata(feature.clone()))?;
        for req in meta.requires {
            if !result.contains(req) {
                result.push(req.clone());
            }
        }
        idx += 1;
    }

    Ok(dedup(result))
}

fn validate_conflicts(features: &[Feature]) -> Result<(), ResolverError> {
    let registry = feature_registry();
    for feature in features {
        let meta = registry
            .get(feature)
            .ok_or_else(|| ResolverError::UnknownFeatureMetadata(feature.clone()))?;
        for conflict in meta.conflicts {
            if features.contains(conflict) {
                return Err(ResolverError::Conflict {
                    left: feature.clone(),
                    right: conflict.clone(),
                });
            }
        }
    }

    Ok(())
}

fn topo_sort(features: &[Feature]) -> Result<Vec<Feature>, ResolverError> {
    #[derive(Clone, Copy, Eq, PartialEq)]
    enum Mark {
        Temp,
        Perm,
    }

    let registry = feature_registry();
    let mut marks: HashMap<Feature, Mark> = HashMap::new();
    let mut ordered = Vec::new();
    let feature_set: HashSet<Feature> = features.iter().cloned().collect();

    fn visit(
        feature: &Feature,
        registry: &HashMap<Feature, crate::schema::FeatureMeta>,
        marks: &mut HashMap<Feature, Mark>,
        ordered: &mut Vec<Feature>,
        feature_set: &HashSet<Feature>,
    ) -> Result<(), ResolverError> {
        if let Some(mark) = marks.get(feature) {
            if *mark == Mark::Perm {
                return Ok(());
            }
            return Err(ResolverError::CyclicDependency(feature.clone()));
        }

        marks.insert(feature.clone(), Mark::Temp);
        let meta = registry
            .get(feature)
            .ok_or_else(|| ResolverError::UnknownFeatureMetadata(feature.clone()))?;
        for req in meta.requires {
            if feature_set.contains(req) {
                visit(req, registry, marks, ordered, feature_set)?;
            }
        }

        marks.insert(feature.clone(), Mark::Perm);
        ordered.push(feature.clone());
        Ok(())
    }

    for feature in features {
        if !matches!(marks.get(feature), Some(Mark::Perm)) {
            visit(feature, &registry, &mut marks, &mut ordered, &feature_set)?;
        }
    }

    Ok(dedup(ordered))
}

fn dedup(features: Vec<Feature>) -> Vec<Feature> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for feature in features {
        if seen.insert(feature.clone()) {
            result.push(feature);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{Linting, PackageManager, Routing, StateManagement, Styling};

    fn config(framework: Framework) -> ProjectConfig {
        ProjectConfig {
            project_name: "demo".to_owned(),
            framework,
            package_manager: PackageManager::Npm,
            styling: Styling::Tailwind,
            linting: Linting::Eslint,
            state_management: StateManagement::None,
            routing: Routing::None,
            dependencies: vec![],
            dev_dependencies: vec![],
        }
    }

    #[test]
    fn adds_required_features() {
        let mut cfg = config(Framework::Nextjs);
        cfg.routing = Routing::ReactRouter;
        let plan = resolve_from_config(&cfg).expect("resolver should succeed");
        assert!(plan.selected.contains(&Feature::Nextjs));
        assert!(plan.selected.contains(&Feature::React));
        assert!(plan.selected.contains(&Feature::ReactRouter));
    }

    #[test]
    fn sorts_dependencies_before_dependents() {
        let plan =
            resolve_from_config(&config(Framework::Nextjs)).expect("resolver should succeed");
        let react_idx = plan
            .ordered
            .iter()
            .position(|f| *f == Feature::React)
            .expect("react should be present");
        let next_idx = plan
            .ordered
            .iter()
            .position(|f| *f == Feature::Nextjs)
            .expect("nextjs should be present");
        assert!(react_idx < next_idx);
    }

    #[test]
    fn fails_on_conflicts() {
        let cfg = ProjectConfig {
            project_name: "demo".to_owned(),
            framework: Framework::Vue,
            package_manager: PackageManager::Npm,
            styling: Styling::Tailwind,
            linting: Linting::Eslint,
            state_management: StateManagement::Redux,
            routing: Routing::None,
            dependencies: vec![],
            dev_dependencies: vec![],
        };

        let err = resolve_from_config(&cfg).expect_err("resolver should fail");
        assert!(
            matches!(err, ResolverError::Conflict { .. }),
            "expected conflict, got {err:?}"
        );
    }
}
