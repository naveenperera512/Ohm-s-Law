// Copyright 2016-2021, University of Colorado Boulder

/**
 * Generates the top-level simName-accessibility-view.html file for simulations (or runnables). Lets one
 * see the accessible content by placing the sim in an iframe and running an up to date copy of the parallel
 * DOM next to it.
 *
 * @author Jesse Greenberg
 */


// modules
const ChipperConstants = require( '../common/ChipperConstants' );
const ChipperStringUtils = require( '../common/ChipperStringUtils' );
const getA11yViewHTMLFromTemplate = require( './getA11yViewHTMLFromTemplate' );
const grunt = require( 'grunt' );

/**
 * @param {string} repo
 */
module.exports = function( repo ) {

  let html = getA11yViewHTMLFromTemplate( repo );
  html = ChipperStringUtils.replaceFirst( html, '{{PHET_REPOSITORY}}', repo );

  // Write to the repository's root directory.
  grunt.file.write( `../${repo}/${repo}${ChipperConstants.A11Y_VIEW_HTML_SUFFIX}`, html );
};
