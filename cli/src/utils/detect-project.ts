/**
 * Project Type Detection
 * Analyzes the current directory to determine the project type
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ProjectType =
  | 'nextjs'
  | 'express'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'node'
  | 'unknown';

export interface ProjectInfo {
  type: ProjectType;
  name: string;
  hasTypescript: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  srcDir: string | null;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Detect the project type from the current directory
 */
export function detectProject(cwd: string = process.cwd()): ProjectInfo {
  const packageJsonPath = join(cwd, 'package.json');

  // Default values
  let projectInfo: ProjectInfo = {
    type: 'unknown',
    name: 'my-project',
    hasTypescript: false,
    packageManager: 'npm',
    srcDir: null
  };

  // Check if package.json exists
  if (!existsSync(packageJsonPath)) {
    return projectInfo;
  }

  try {
    const packageJson: PackageJson = JSON.parse(
      readFileSync(packageJsonPath, 'utf-8')
    );

    projectInfo.name = packageJson.name || 'my-project';

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Check for TypeScript
    projectInfo.hasTypescript = 'typescript' in allDeps || existsSync(join(cwd, 'tsconfig.json'));

    // Detect package manager
    if (existsSync(join(cwd, 'bun.lockb'))) {
      projectInfo.packageManager = 'bun';
    } else if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
      projectInfo.packageManager = 'pnpm';
    } else if (existsSync(join(cwd, 'yarn.lock'))) {
      projectInfo.packageManager = 'yarn';
    }

    // Detect src directory
    if (existsSync(join(cwd, 'src'))) {
      projectInfo.srcDir = 'src';
    } else if (existsSync(join(cwd, 'app'))) {
      projectInfo.srcDir = 'app';
    }

    // Detect framework (order matters - more specific first)
    if ('next' in allDeps) {
      projectInfo.type = 'nextjs';
      // Next.js 13+ uses app directory
      if (existsSync(join(cwd, 'app'))) {
        projectInfo.srcDir = 'app';
      } else if (existsSync(join(cwd, 'src/app'))) {
        projectInfo.srcDir = 'src/app';
      } else if (existsSync(join(cwd, 'src/pages'))) {
        projectInfo.srcDir = 'src/pages';
      } else if (existsSync(join(cwd, 'pages'))) {
        projectInfo.srcDir = 'pages';
      }
    } else if ('express' in allDeps || 'fastify' in allDeps || 'hono' in allDeps || 'koa' in allDeps) {
      projectInfo.type = 'express';
    } else if ('vue' in allDeps || '@vue/core' in allDeps) {
      projectInfo.type = 'vue';
    } else if ('svelte' in allDeps || '@sveltejs/kit' in allDeps) {
      projectInfo.type = 'svelte';
    } else if ('react' in allDeps || 'react-dom' in allDeps) {
      projectInfo.type = 'react';
    } else if (existsSync(packageJsonPath)) {
      projectInfo.type = 'node';
    }

    return projectInfo;
  } catch {
    return projectInfo;
  }
}

/**
 * Get a human-readable description of the project type
 */
export function getProjectTypeLabel(type: ProjectType): string {
  const labels: Record<ProjectType, string> = {
    nextjs: 'Next.js',
    express: 'Express/Node API',
    react: 'React',
    vue: 'Vue.js',
    svelte: 'Svelte/SvelteKit',
    node: 'Node.js',
    unknown: 'Unknown'
  };
  return labels[type];
}
