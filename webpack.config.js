import _ from 'lodash';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseConfig = {
  entry: './src/index.js',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader"
      }
    ]
  },
  output: {
    path: __dirname,
    library: 'espn-fantasy-football-api',
    libraryTarget: 'umd'
  },
  target: 'web',
  devtool: 'source-map',
  mode: 'development'
};

export default [
  _.merge({}, baseConfig, {
    output: {
      filename: 'web.js'
    },
    mode: 'production',
    devtool: undefined,
  }),
  _.merge({}, baseConfig, {
    output: {
      filename: 'web-dev.js'
    }
  }),
  _.merge({}, baseConfig, {
    output: {
      filename: 'node.js'
    },
    mode: 'production',
    devtool: undefined,
    target: 'node'
  }),
  _.merge({}, baseConfig, {
    output: {
      filename: 'node-dev.js'
    },
    target: 'node'
  })
];
