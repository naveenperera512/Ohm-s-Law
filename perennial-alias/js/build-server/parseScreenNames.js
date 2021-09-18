// Copyright 2021, University of Colorado Boulder

const axios = require( 'axios' );
const puppeteer = require( 'puppeteer' );

/**
 *
 * @param {string} simName
 * @param {object} page - a puppeteer object
 * @param {string[]} locales - a list of locale codes
 * @returns {Promise.<{}>}
 */
const parseScreenNamesFromSimulation = async ( simName, page, locales ) => {
  const returnObject = {};

  for ( let localeIndex = 0; localeIndex < locales.length; localeIndex++ ) {
    const locale = locales[ localeIndex ];

    const s = `https://phet.colorado.edu/sims/html/${simName}/latest/${simName}_all.html?locale=${locale}`;
    await page.goto( s );
    await page.waitForFunction( 'phet' );
    await page.waitForFunction( 'phet.joist' );
    await page.waitForFunction( 'phet.joist.sim' );
    await page.waitForFunction( 'phet.joist.sim.screens' );
    returnObject[ locale ] = await page.evaluate( () => {
      return phet.joist.sim.screens
        .map( screen => screen.name || ( screen.nameProperty && screen.nameProperty.value ) )
        .filter( ( screenName, screenIndex ) => !( screenIndex === 0 && screenName === '\u202aHome\u202c' ) );
    } );
  }

  return returnObject;
};

const parseScreenNamesAllSimulations = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const url = 'https://phet.colorado.edu/services/metadata/1.3/simulations?format=json&type=html&summary';
  const projects = ( await axios.get( url ) ).data.projects;

  const screenNameObject = {};

  for ( let projectIndex = 0; projectIndex < projects.length; projectIndex++ ) {
    const project = projects[ projectIndex ];
    const simulation = project.simulations[ 0 ];
    const simName = simulation.name;
    const locales = Object.keys( simulation.localizedSimulations );
    screenNameObject[ simName ] = await parseScreenNamesFromSimulation( simName, page, locales );
  }

  await browser.close();
  return screenNameObject;
};

const parseScreenNames = async ( simName, locales ) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const screenNameObject = await parseScreenNamesFromSimulation( simName, page, locales );


  await browser.close();
  return screenNameObject;
};

module.exports = {
  parseScreenNames: parseScreenNames,
  parseScreenNamesAllSimulations: parseScreenNamesAllSimulations
};