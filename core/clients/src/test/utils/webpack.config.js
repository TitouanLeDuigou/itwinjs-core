/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const glob = require("glob");
const webpack = require("webpack");
const raw = require("@bentley/config-loader/lib/IModelJsConfig").IModelJsConfig.init(true /*suppress error*/, true);

const clientsLib = path.resolve(__dirname, "../../../lib");

function createConfig(shouldInstrument) {
  const config = {
    mode: "development",
    entry: glob.sync(path.resolve(clientsLib, "test/**/*.test.js")),
    output: {
      path: path.resolve(clientsLib, "test/webpack/"),
      filename: "bundled-tests.js",
      devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
    },
    devtool: "nosources-source-map",
    module: {
      noParse: [
        // Don't parse draco_*_nodejs.js modules for `require` calls.  There are
        // requires for fs that cause it to fail even though the fs dependency
        // is not used.
        /draco_decoder_nodejs.js$/,
        /draco_encoder_nodejs.js$/
      ],
      rules: [
        {
          test: /\.js$/,
          use: "source-map-loader",
          enforce: "pre"
        },
        {
          test: /azure-storage|AzureFileHandler|UrlFileHandler/,
          use: "null-loader"
        },
      ]
    },
    stats: "errors-only",
    optimization: {
      nodeEnv: "production"
    },
    plugins: [
      // Makes some environment variables available to the JS code, for example:
      // if (process.env.NODE_ENV === "development") { ... }. See `./env.js`.
      new webpack.DefinePlugin({
        "process.env": Object.keys(raw)
          .filter((key) => {
            return key.match(/^imjs_/i);
          })
          .reduce((env, key) => {
            env[key] = JSON.stringify(raw[key]);
            return env;
          }, {
            IMODELJS_CORE_DIRNAME: JSON.stringify(path.join(__dirname, "../..")),
          }),
      })
    ]
  };

  if (shouldInstrument) {
    config.output.filename = "bundled-tests.instrumented.js";
    config.module.rules.push({
      test: /\.(jsx?|tsx?)$/,
      include: clientsLib,
      exclude: path.join(clientsLib, "test"),
      loader: require.resolve("istanbul-instrumenter-loader"),
      options: {
        debug: true
      },
      enforce: "post",
    });
  }

  return config;
}

// Exporting two configs in a array like this actually tells webpack to run twice - once for each config.
module.exports = [
  createConfig(true),
  createConfig(false)
]
