// Copyright 2019-2021, University of Colorado Boulder

/**
 * This characterizes events that may be emitted from PhetioObjects to the PhET-iO data stream.
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Enumeration from '../../phet-core/js/Enumeration.js';
import EnumerationIO from '../../phet-core/js/EnumerationIO.js';
import TandemConstants from './TandemConstants.js';
import tandemNamespace from './tandemNamespace.js';

const EventType = Enumeration.byKeys( [

  // The user has taken an action, such as pressing a button or moving a mouse
  'USER',

  // An event was produced by the simulation model. This could be in response to a user event, or something that happens
  // during the simulation step. Note the separation is not model vs view, but user-driven vs automatic.
  TandemConstants.EVENT_TYPE_MODEL,

  // An event was triggered by the PhET-iO wrapper, via PhetioEngineIO.triggerEvent
  'WRAPPER',

  // These messages are suppressed, use this to opt a PhetioObject out of the data stream feature.
  'OPT_OUT'
], {
  beforeFreeze: EventType => {
    EventType.phetioType = EnumerationIO( EventType );
  }
} );

tandemNamespace.register( 'EventType', EventType );
export default EventType;