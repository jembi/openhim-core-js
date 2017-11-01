module.exports = function (wallaby) {
  return {
    files: [
      'src/**/*.js',
      'test/*.js',
      '!test/**/*Tests.js',
      '!test/**/*Test.js',
      {
        pattern: 'test/resources/**/*',
        load: false,
        instrument: false
      },
      {
        pattern: 'config/**/*',
        load: false,
        instrument: false
      },
      {
        pattern: 'resources/**/*',
        load: false,
        instrument: false
      },
      {
        pattern: 'package.json',
        load: false,
        instrument: false
      }
    ],
    testFramework: 'mocha',
    tests: [
      'test/setupTest.js',
      'test/unit/tasksTest.js'
    ],
    compilers: {
      '**/*.js': wallaby.compilers.babel()
    },
    workers: {
      initial: 1,
      regular: 1
    },
    env: {
      type: 'node',
      runner: 'node',
      params: {
        env: 'NODE_ENV=test NODE_TLS_REJECT_UNAUTHORIZED=0 '
      }
    }
  }
}
