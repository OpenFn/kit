import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function checkDependencies() {
  try {
    // Check for missing dependencies
    execSync('pnpm dedupe', { stdio: 'inherit' });
    
    // Verify node_modules exists in root and all packages
    const packages = fs.readdirSync('packages')
      .filter(file => fs.statSync(path.join('packages', file)).isDirectory());
    
    // Check root node_modules
    if (!fs.existsSync('node_modules')) {
      throw new Error('Root node_modules missing');
    }

    // Check package node_modules
    for (const pkg of packages) {
      const nodeModulesPath = path.join('packages', pkg, 'node_modules');
      const packageJsonPath = path.join('packages', pkg, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        continue; // Skip if no package.json
      }

      // Read package dependencies
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
      };

      // Check if all declared dependencies are installed
      for (const dep in allDeps) {
        const depPath = path.join('node_modules', dep);
        const workspacePath = path.join('packages', pkg, 'node_modules', dep);
        
        if (!fs.existsSync(depPath) && !fs.existsSync(workspacePath)) {
          throw new Error(`Missing dependency ${dep} in package ${pkg}`);
        }
      }
    }

    // Verify peer dependencies
    execSync('pnpm install --no-frozen-lockfile', { stdio: 'inherit' });
    
    console.log('✅ All dependencies are properly installed');
  } catch (error) {
    console.error('❌ Dependency verification failed:', error.message);
    process.exit(1);
  }
}

checkDependencies(); 