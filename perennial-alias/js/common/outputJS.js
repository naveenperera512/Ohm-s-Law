// Copyright 2017, University of Colorado Boulder

/**
 * Runs `grunt output-js`
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 * @author Sam Reid (PhET Interactive Simulations)
 */

const execute = require( '../dual/execute' );
const fs = require( 'fs' );
const gruntCommand = require( '../common/gruntCommand' );
const winston = require( 'winston' );
const ChipperVersion = require( '../common/ChipperVersion' );
const loadJSON = require( '../common/loadJSON' );

/**
 * Outputs JS for a directory
 * @public
 *
 * @param {string} repo
 * @returns {Promise}
 */
module.exports = async function( repo ) {

  winston.info( 'running outputJS' );

  const chipperVersion = ChipperVersion.getFromRepository();

  let ranOutputJS = false;

  // Not every version of chipper has the output-js task family.  Only proceed if it exists in this version of chipper.
  if ( chipperVersion.chipperSupportsOutputJSGruntTasks ) {

    const packageFilePath = `../${repo}/package.json`;
    const exists = fs.existsSync( packageFilePath );
    if ( exists ) {
      const packageObject = await loadJSON( packageFilePath );

      // Not every repo supports the output-js task, only proceed if it is supported
      if ( packageObject.phet && packageObject.phet.supportsOutputJS ) {
        winston.info( 'running grunt output-js' );
        await execute( gruntCommand, [ 'output-js' ], `../${repo}` );
        ranOutputJS = true;
      }
    }
  }
  if ( !ranOutputJS ) {
    winston.info( 'outputJS not detected, skipping...' );
  }
};