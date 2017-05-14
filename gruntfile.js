const webpackConfig = require('./webpack.config');

module.exports = function(grunt) {
  grunt.initConfig({
    webpack: {
      default: webpackConfig
    },
    testem: {
      unit: {
        options: {
          framework: 'jasmine2',
          launch_in_dev: ['PhantomJS'],
          before_tests: 'grunt webpack',
          serve_files: [
            'node_modules/requirejs/require.js',
            'node_modules/lodash/lodash.js',
            'node_modules/jquery/dist/jquery.js',
            'node_modules/sinon/pkg/sinon.js',
            'tests.js'
          ],
          watch_files: [
            'src/**/*.ts',
            'test/**/*.ts'
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-testem');
  grunt.loadNpmTasks('grunt-webpack');

  grunt.registerTask('default', ['testem:run:unit']);
};
