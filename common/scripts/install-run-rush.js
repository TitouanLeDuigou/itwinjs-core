"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See the @microsoft/rush package's LICENSE file for license information.
Object.defineProperty(exports, "__esModule", { value: true });
// THIS FILE WAS GENERATED BY A TOOL. ANY MANUAL MODIFICATIONS WILL GET OVERWRITTEN WHENEVER RUSH IS UPGRADED.
//
// This script is intended for usage in an automated build environment where the Rush command may not have
// been preinstalled, or may have an unpredictable version.  This script will automatically install the version of Rush
// specified in the rush.json configuration file (if not already installed), and then pass a command-line to it.
// An example usage would be:
//
//    node common/scripts/install-run-rush.js install
//
// For more information, see: https://rushjs.io/pages/maintainer/setup_new_repo/
const path = require("path");
const fs = require("fs");
const install_run_1 = require("./install-run");
const PACKAGE_NAME = '@microsoft/rush';
function getRushVersion() {
    const rushJsonFolder = install_run_1.findRushJsonFolder();
    const rushJsonPath = path.join(rushJsonFolder, install_run_1.RUSH_JSON_FILENAME);
    try {
        const rushJsonContents = fs.readFileSync(rushJsonPath, 'UTF-8');
        // Use a regular expression to parse out the rushVersion value because rush.json supports comments,
        // but JSON.parse does not and we don't want to pull in more dependencies than we need to in this script.
        const rushJsonMatches = rushJsonContents.match(/\"rushVersion\"\s*\:\s*\"([0-9a-zA-Z.+\-]+)\"/);
        return rushJsonMatches[1];
    }
    catch (e) {
        throw new Error(`Unable to determine the required version of Rush from rush.json (${rushJsonFolder}). ` +
            'The \'rushVersion\' field is either not assigned in rush.json or was specified ' +
            'using an unexpected syntax.');
    }
}
function run() {
    const [nodePath, /* Ex: /bin/node */ // tslint:disable-line:no-unused-variable
    scriptPath, /* /repo/common/scripts/install-run-rush.js */ // tslint:disable-line:no-unused-variable
    ...packageBinArgs /* [build, --to, myproject] */] = process.argv;
    if (process.argv.length < 3) {
        console.log('Usage: install-run-rush.js <command> [args...]');
        console.log('Example: install-run-rush.js build --to myproject');
        process.exit(1);
    }
    install_run_1.runWithErrorAndStatusCode(() => {
        const version = getRushVersion();
        console.log(`The rush.json configuration requests Rush version ${version}`);
        return install_run_1.installAndRun(PACKAGE_NAME, version, 'rush', packageBinArgs);
    });
}
run();

//# sourceMappingURL=install-run-rush.js.map
