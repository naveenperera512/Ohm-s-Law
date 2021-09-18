// Copyright 2019-2021, University of Colorado Boulder

/**
 * "definition" type for generalized alerts (anything that can be spoken by an
 * assistive device without requiring active focus). This includes anything
 * that can move through utteranceQueue.
 *
 * @author Jesse Greenberg
 */

import ResponsePacket from './ResponsePacket.js';
import Utterance from './Utterance.js';
import utteranceQueueNamespace from './utteranceQueueNamespace.js';

/**
 * @typedef AlertableDef
 * @type {Array.<AlertableDef>|string|number|Utterance}
 */
const AlertableDef = {

  /**
   * Returns whether the parameter is considered to be a alertable, for use in utteranceQueue. An item is alertable
   * if it passes isItemAlertable, OR is an array of those items. See isItemAlertable for supported types of
   * individual items. See utterance.js for documentation about why an array is beneficial.
   * @param  {*}  alertable
   * @returns {boolean}
   * @public
   */
  isAlertableDef: function( alertable ) {
    let isAlertable = true;

    // if array, check each item individually
    if ( Array.isArray( alertable ) ) {
      for ( let i = 0; i < alertable.length; i++ ) {
        isAlertable = isItemAlertable( alertable[ i ] ) && !( alertable[ i ] instanceof Utterance );
        if ( !isAlertable ) { break; }
      }
    }
    else {
      isAlertable = isItemAlertable( alertable );
    }

    return isAlertable;
  }
};

/**
 * Check whether a single item is alertable.
 * @param  {*}  alertable
 * @returns {boolean} - returns true if the arg is an alertable item.
 */
const isItemAlertable = function( alertable ) {
  return typeof alertable === 'string' ||
         typeof alertable === 'number' ||
         alertable instanceof ResponsePacket ||
         alertable instanceof Utterance;
};

utteranceQueueNamespace.register( 'AlertableDef', AlertableDef );

export default AlertableDef;