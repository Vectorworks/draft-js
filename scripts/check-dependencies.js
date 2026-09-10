'use strict';

const PluginError = require('plugin-error');
const {spawn} = require('child_process');

const PLUGIN_NAME = 'check-dependencies';

module.exports = function checkDependencies(cwd) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npm = spawn(
      isWindows ? process.env.ComSpec || 'cmd.exe' : 'npm',
      isWindows
        ? ['/d', '/s', '/c', 'npm ls --depth=0 --json']
        : ['ls', '--depth=0', '--json'],
      {cwd},
    );
    let stdout = '';
    let stderr = '';

    npm.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    npm.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    npm.on('error', error => {
      reject(new PluginError(PLUGIN_NAME, error.message));
    });

    npm.on('close', code => {
      let result;

      try {
        result = JSON.parse(stdout);
      } catch (error) {
        reject(
          new PluginError(
            PLUGIN_NAME,
            `Unable to parse npm dependency output: ${error.message}`,
          ),
        );
        return;
      }

      const problems = Array.isArray(result.problems) ? result.problems : [];

      if (code !== 0 || problems.length) {
        const details = problems.join('\n') || stderr.trim();
        reject(
          new PluginError(
            PLUGIN_NAME,
            details || `npm ls exited with code ${code}`,
          ),
        );
        return;
      }

      resolve();
    });
  });
};
