import { execSync } from 'child_process';

function verifyEnvironment() {
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (major < 18) {
      throw new Error(`Node.js version must be >=18. Current: ${nodeVersion}`);
    }

    // Check pnpm version
    const pnpmVersion = execSync('pnpm --version').toString().trim();
    const [pnpmMajor] = pnpmVersion.split('.');
    
    if (parseInt(pnpmMajor) < 8) {
      throw new Error(`pnpm version must be >=8. Current: ${pnpmVersion}`);
    }

    // Verify essential build tools
    try {
      execSync('tsc --version', { stdio: 'pipe' });
    } catch {
      throw new Error('TypeScript compiler (tsc) not found. Please install typescript globally.');
    }

    // Check for required environment variables
    const requiredEnvVars = [
      'NODE_ENV'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        process.env[envVar] = 'test'; // Set default for testing
      }
    }

    // Verify that we can import ESM packages
    const testESM = `
      import { createRequire } from 'module';
      console.log('ESM imports working');
    `;
    
    execSync(`node --input-type=module -e "${testESM}"`, { stdio: 'pipe' });

    console.log('✅ Environment verification passed:');
    console.log(`  Node.js: ${nodeVersion}`);
    console.log(`  pnpm: ${pnpmVersion}`);
    console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);

  } catch (error) {
    console.error('❌ Environment verification failed:', error.message);
    process.exit(1);
  }
}

verifyEnvironment(); 