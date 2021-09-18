// Copyright 2015-2021, University of Colorado Boulder

/**
 * Given a rectangular containing area, takes care of allocating and deallocating smaller rectangular "bins" that fit
 * together inside the area and do not overlap. Optimized more for runtime CPU usage than space currently.
 *
 * For example:
 * #begin canvasExample binPacker 256x256
 * #on
 * var binPacker = new dot.BinPacker( new dot.Bounds2( 0, 0, 256, 256 ) );
 * var bins = [];
 * for ( var i = 0; i < 100; i++ ) {
 *   var bin = binPacker.allocate( Math.random() * 64, Math.random() * 64 );
 *   if ( bin ) {
 *     bins.push( bin );
 *   }
 * }
 * #off
 *
 * context.strokeStyle = '#000';
 * bins.forEach( function( bin ) {
 *   var bounds = bin.bounds;
 *   context.strokeRect( bounds.x, bounds.y, bounds.width, bounds.height );
 * } );
 * #end canvasExample
 *
 * @author Sharfudeen Ashraf
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from './Bounds2.js';
import dot from './dot.js';

class BinPacker {
  /**
   * Creates a BinPacker with the specified containing bounds.
   * @public
   *
   * @param {Bounds2} bounds - The available bounds to pack bins inside.
   */
  constructor( bounds ) {
    this.rootBin = new dot.BinPacker.Bin( bounds, null );
  }

  /**
   * Allocates a bin with the specified width and height if possible (returning a {Bin}), otherwise returns null.
   * @public
   *
   * @param {number} width
   * @param {number} height
   * @returns {Bin|null}
   */
  allocate( width, height ) {
    // find a leaf bin that has available room (or null)
    const bin = this.rootBin.findAvailableBin( width, height );

    if ( bin ) {
      // split it into a sized sub-bin for our purpose that we will use, and other bins for future allocations
      const sizedBin = bin.split( width, height );

      // mark our bin as used
      sizedBin.use();

      return sizedBin;
    }
    else {
      return null;
    }
  }

  /**
   * Deallocates a bin, so that its area can be reused by future allocations.
   * @public
   *
   * @param {Bin} bin - The bin that was returned from allocate().
   */
  deallocate( bin ) {
    bin.unuse();
  }

  /**
   * @private, for debugging purposes
   * @returns {string}
   */
  toString() {
    let result = '';

    let padding = '';

    function binTree( bin ) {
      result += `${padding + bin.toString()}\n`;
      padding = `${padding}  `;
      _.each( bin.children, binTree );
      padding = padding.substring( 2 );
    }

    binTree( this.rootBin );

    return result;
  }
}

dot.register( 'BinPacker', BinPacker );

class Bin {
  /**
   * A rectangular bin that can be used itself or split into sub-bins.
   * @public
   *
   * @param {Bounds2} bounds
   * @param {Bin|null} parent
   */
  constructor( bounds, parent ) {
    // @public {Bounds2} - Our containing bounds
    this.bounds = bounds;

    // @private {Bin|null} - Parent bin, if applicable
    this.parent = parent;

    // @private {boolean} - Whether our children are responsible for our area
    this.isSplit = false;

    // @private {boolean} - Whether we are marked as a bin that is used
    this.isUsed = false;

    // @private {Array.<Bin>}
    this.children = [];
  }

  /**
   * Finds an unused bin with open area that is at least width-x-height in size.
   * @private
   *
   * @param {number} width
   * @param {number} height
   * @returns {Bin|null}
   */
  findAvailableBin( width, height ) {
    assert && assert( width > 0 && height > 0, 'Empty bin requested?' );

    // If we are marked as used ourself, we can't be used
    if ( this.isUsed ) {
      return null;
    }
    // If our bounds can't fit it, skip this entire sub-tree
    else if ( this.bounds.width < width || this.bounds.height < height ) {
      return null;
    }
    // If we have been split, check our children
    else if ( this.isSplit ) {
      for ( let i = 0; i < this.children.length; i++ ) {
        const result = this.children[ i ].findAvailableBin( width, height );
        if ( result ) {
          return result;
        }
      }
      // No child can fit the area
      return null;
    }
    // Otherwise we are free and our dimensions are compatible (checked above)
    else {
      return this;
    }
  }

  /**
   * Splits this bin into multiple child bins, and returns the child with the dimensions (width,height).
   * @private
   *
   * @param {number} width
   * @param {number} height
   */
  split( width, height ) {
    assert && assert( this.bounds.width >= width && this.bounds.height >= height,
      'Bin does not have space' );
    assert && assert( !this.isSplit, 'Bin should not be re-split' );
    assert && assert( !this.isUsed, 'Bin should not be split when used' );
    assert && assert( width > 0 && height > 0, 'Empty bin requested?' );

    // if our dimensions match exactly, don't split (return ourself)
    if ( width === this.bounds.width && height === this.bounds.height ) {
      return this;
    }

    // mark as split
    this.isSplit = true;

    // locations of the split
    const splitX = this.bounds.minX + width;
    const splitY = this.bounds.minY + height;

    /*
     * How an area is split (for now). In the future, splitting more after determining what we need to fit next would
     * potentially be better, but this preserves the width better (which many times we need).
     *
     *   ************************************
     *   *                  *               *
     *   *                  *               *
     *   *       main       *     right     *
     *   * (width x height) *               *
     *   *                  *               *
     *   ************************************
     *   *                                  *
     *   *              bottom              *
     *   *                                  *
     *   ************************************
     */
    const mainBounds = new Bounds2( this.bounds.minX, this.bounds.minY, splitX, splitY );
    const rightBounds = new Bounds2( splitX, this.bounds.minY, this.bounds.maxX, splitY );
    const bottomBounds = new Bounds2( this.bounds.minX, splitY, this.bounds.maxX, this.bounds.maxY );

    const mainBin = new dot.BinPacker.Bin( mainBounds, this );
    this.children.push( mainBin );

    // only add right/bottom if they take up area
    if ( rightBounds.hasNonzeroArea() ) {
      this.children.push( new dot.BinPacker.Bin( rightBounds, this ) );
    }
    if ( bottomBounds.hasNonzeroArea() ) {
      this.children.push( new dot.BinPacker.Bin( bottomBounds, this ) );
    }

    return mainBin;
  }

  /**
   * Mark this bin as used.
   * @private
   */
  use() {
    assert && assert( !this.isSplit, 'Should not mark a split bin as used' );
    assert && assert( !this.isUsed, 'Should not mark a used bin as used' );

    this.isUsed = true;
  }

  /**
   * Mark this bin as not used, and attempt to collapse split parents if all children are unused.
   * @private
   */
  unuse() {
    assert && assert( this.isUsed, 'Can only unuse a used instance' );

    this.isUsed = false;

    this.parent && this.parent.attemptToCollapse();
  }

  /**
   * If our bin can be collapsed (it is split and has children that are not used AND not split), then we will become
   * not split, and will remove our children. If successful, it will also call this on our parent, fully attempting
   * to clean up unused data structures.
   * @private
   */
  attemptToCollapse() {
    assert && assert( this.isSplit, 'Should only attempt to collapse split bins' );

    // Bail out if a single child isn't able to be collapsed. If it is not split or used, it won't have any children
    // or needs.
    for ( let i = 0; i < this.children.length; i++ ) {
      const child = this.children[ i ];

      if ( child.isSplit || child.isUsed ) {
        return;
      }
    }

    // We can now collapse ourselves neatly
    this.children = [];
    this.isSplit = false;

    // And attempt to collapse our parent
    this.parent && this.parent.attemptToCollapse();
  }

  /**
   * @private, for debugging purposes
   * @returns {string}
   */
  toString() {
    return this.bounds.toString() + ( this.isUsed ? ' used' : '' );
  }
}

BinPacker.Bin = Bin;

export default BinPacker;