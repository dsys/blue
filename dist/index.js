#! /usr/bin/env node
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _handlebars = require('handlebars');

var _handlebars2 = _interopRequireDefault(_handlebars);

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _minimist = require('minimist');

var _minimist2 = _interopRequireDefault(_minimist);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var HANDLEBARS_CONFIG = { strict: true, noEscape: true };
var MISSING_ARG_REGEX = /^"([\w]+)" not defined in/;

function runHandlebars(template, args) {
  try {
    var compiled = _handlebars2.default.compile(template, HANDLEBARS_CONFIG);
    return compiled(args);
  } catch (err) {
    var matches = err.message.match(MISSING_ARG_REGEX);
    if (matches) {
      var argName = matches[1];
      throw new Error('arg \'' + argName + '\' not provided');
    } else {
      throw err;
    }
  }
}

function printHelp() {
  console.log('usage: blue NAME [...OPTS]');
  console.log('available blueprints: ' + Object.keys(blueprints));
}

function printBlueprintHelp(blueprint) {
  console.log(blueprint.name + ': ' + blueprint.directory);
  for (var filename in blueprint.files) {
    console.log('- ' + filename);
  }
}

function findGitRoot() {
  try {
    var stdout = _child_process2.default.execSync('git rev-parse --show-toplevel', { stdio: ['pipe', 'pipe', 'ignore'] });
    return stdout.toString().trim();
  } catch (err) {
    // ignore err, return cwd
    return __dirname;
  }
}

var Blueprint = function () {
  function Blueprint(name, directory) {
    _classCallCheck(this, Blueprint);

    this.name = name;
    this.directory = directory;
    this.files = {};
  }

  _createClass(Blueprint, [{
    key: 'load',
    value: function load() {
      var filesGlob = _path2.default.join(this.directory, '**', '*');
      var files = _glob2.default.sync(filesGlob, { nodir: true });
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = files[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var file = _step.value;

          var relFilename = _path2.default.relative(this.directory, file);
          var fileContents = _fs2.default.readFileSync(file, 'utf-8');
          this.files[relFilename] = fileContents;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }, {
    key: 'template',
    value: function template(positionals, named) {
      var view = Object.assign({}, named, positionals);
      var result = {};
      for (var relFilename in this.files) {
        var fileContents = this.files[relFilename];
        var templName = runHandlebars(relFilename, view);
        var templContents = runHandlebars(fileContents, view);
        result[templName] = templContents;
      }
      return result;
    }
  }]);

  return Blueprint;
}();

var blueprints = {};
for (var dir = __dirname; dir !== '/'; dir = _path2.default.resolve(dir, '..')) {
  var blueprintsGlob = _path2.default.join(dir, 'blueprints', '*') + '/'; // only directories
  var blueprintDirs = _glob2.default.sync(blueprintsGlob);
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = blueprintDirs[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var _dir = _step2.value;

      var _blueprintName = _path2.default.basename(_dir);
      if (!(_blueprintName in blueprints)) {
        blueprints[_blueprintName] = new Blueprint(_blueprintName, _dir);
      }
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }
}
var argv = (0, _minimist2.default)(process.argv);

if (argv._.length === 2) {
  printHelp();
  process.exit(0);
}

var blueprintName = argv._[2];

if (!(blueprintName in blueprints)) {
  console.error('unknown blueprint \'' + blueprintName + '\'');
  printHelp();
  process.exit(1);
}

var blueprint = blueprints[blueprintName];
blueprint.load();

if (argv._.length === 3 && Object.keys(argv).length === 1) {
  printBlueprintHelp(blueprint);
  process.exit(0);
}

try {
  var positionals = argv._.slice(3);
  var templated = blueprint.template(positionals, argv);
  var filenames = Object.keys(templated).sort();

  var root = findGitRoot();

  console.log('applying ' + blueprint.name + ': ' + blueprint.directory);
  for (var filename in templated) {
    var abs = _path2.default.join(root, filename);
    var contents = templated[filename];

    var _dir2 = _path2.default.dirname(abs);
    _mkdirp2.default.sync(_dir2);
    _fs2.default.writeFileSync(filename, contents);

    var rel = _path2.default.relative(__dirname + '/..', filename);
    console.log('+ ' + rel);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}