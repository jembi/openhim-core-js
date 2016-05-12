'use strict'

files =
  src: './src/**/*.coffee'
  test: './test/**/*.coffee'

module.exports = (grunt) ->
  grunt.loadNpmTasks 'grunt-coffeelint'
  grunt.loadNpmTasks 'grunt-contrib-coffee'
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-mocha-cli'
  grunt.loadNpmTasks 'grunt-contrib-watch'

  # increase mocha timeout if these tests are being run on TRAVIS
  mochaTimeout = 2000
  if process.env.TRAVIS
    mochaTimeout = 3000

  grunt.initConfig
    clean: ['./lib/']

    coffee:
      compile:
        options:
          bare: true
          sourceMap: true
        expand: true
        cwd: './src/'
        src: '**/*.coffee'
        dest: './lib/'
        ext: '.js'

    coffeelint:
      options:
        configFile: 'coffeelint.json'
      src:
        files:
          src: [files.src]
      test:
        files:
          src: [files.test]

    mochacli:
      options:
        reporter: 'spec'
        flags: ['--harmony']
        compilers: ['coffee:coffee-script/register']
        env:
          NODE_ENV: 'test'
          NODE_TLS_REJECT_UNAUTHORIZED: 0
        grep: grunt.option 'mochaGrep' || null
        debug: grunt.option 'debugTests' || false
        bail: grunt.option 'bail' || false
        timeout: mochaTimeout
      all:
        files.test

    watch:
      src:
        files: files.src
        tasks: ['build']

  grunt.registerTask 'build', ['clean', 'coffee']
  grunt.registerTask 'lint', ['coffeelint']
  grunt.registerTask 'test', ['coffeelint:src', 'build', 'mochacli']
