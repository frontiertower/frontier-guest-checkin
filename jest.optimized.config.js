/**
 * Optimized Jest Configuration
 * Eliminates flaky tests and improves performance
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  // Performance optimizations
  maxWorkers: '50%', // Use half of available cores
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Test environment setup
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testEnvironment: 'jsdom',
  
  // Module mapping for faster resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/test/(.*)$': '<rootDir>/test/$1',
  },
  
  // Test patterns for organization
  testMatch: [
    '<rootDir>/test/unit/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/test/integration/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/test/e2e/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/test/optimization/**/*.test.{js,jsx,ts,tsx}',
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,ts,jsx,tsx}',
    '!src/app/globals.css',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Transform configuration for performance
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
          },
        },
      },
    }],
  },
  
  // Module path ignores for speed
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
  ],
  
  // Test timeout and retry configuration
  testTimeout: 30000, // 30 seconds max per test
  retry: 1, // Retry flaky tests once
  
  // Reporter configuration for CI/CD
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'junit.xml',
    }],
    ['jest-html-reporters', {
      publicPath: './test-results',
      filename: 'report.html',
      openReport: false,
    }],
  ],
  
  // Global setup for test optimization
  globalSetup: '<rootDir>/test/globalSetup.js',
  globalTeardown: '<rootDir>/test/globalTeardown.js',
  
  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Error handling
  bail: false, // Don't stop on first failure
  verbose: false, // Reduce noise in output
  
  // Experimental features for better performance
  workerIdleMemoryLimit: '512MB',
  
  // Test suites for parallel execution
  projects: [
    // Unit tests - fast, isolated
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.test.{js,ts,jsx,tsx}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/test/setup-unit.js'],
      maxWorkers: '75%',
    },
    
    // Integration tests - moderate speed, database dependent
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.test.{js,ts,jsx,tsx}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/test/setup-integration.js'],
      maxWorkers: '25%',
      testTimeout: 60000,
    },
    
    // E2E tests - slow, full browser automation
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.test.{js,ts,jsx,tsx}'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/test/setup-e2e.js'],
      maxWorkers: 1,
      testTimeout: 120000,
    },
  ],
};

module.exports = createJestConfig(customJestConfig);