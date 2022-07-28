/*
 Copyright 2022 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 *
 * CompareClassInfo
 *  - Compare Class Info
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  7/1/2022 - 0.0.1 -
 * Modified:
 *
 */

class CompareClassInfo extends EventTarget {

  static version = '0.0.1';

  /**
   * @type {ImageryLayer}
   */
  imageryLayer;

  /**
   * @type {string}
   */
  rasterFunctionInfo;

  /**
   * @type {FasterFunction}
   */
  renderingRule;

  /**
   * @type {string[]}
   */
  excludeClasses;

  /**
   * @type {Map<number,{}>}
   */
  classInfoByValue;

  /**
   *
   * @param {ImageryLayer} imageryLayer
   * @param {string} rasterFunctionInfo
   * @param {string[]} excludeClasses
   */
  constructor({imageryLayer, rasterFunctionInfo, excludeClasses = []}) {
    super();

    this.imageryLayer = imageryLayer;
    this.rasterFunctionInfo = rasterFunctionInfo;
    this.excludeClasses = excludeClasses;

    this.initialize();

  }

  /**
   *
   * Blue: 171
   * ClassName: "Water"
   * Count: 1599206
   * Description: "Areas where water was predominantly present throughout the year; may not cover areas with sporadic or ephemeral water; contains little to no sparse vegetation, no rock outcrop nor built up features like docks."
   * Examples: "Rivers, ponds, lakes, oceans, flooded salt plains."
   * Green: 91
   * OBJECTID: 2
   * PopupText: "water"
   * Red: 26
   * UlcPopupText: "Water"
   * Value: 1
   *
   */
  initialize() {
    require([
      "esri/layers/support/RasterFunction",
      'esri/geometry/Polygon'
    ], (RasterFunction, Polygon) => {

      this.renderingRule = new RasterFunction({functionName: this.rasterFunctionInfo.name});

      this.imageryLayer.generateRasterInfo(this.renderingRule).then(rasterInfo => {

        this.classInfoByValue = rasterInfo.attributeTable.features.reduce((byValue, rasterFeature) => {
          //console.info(rasterFeature.attributes);

          if (!this.excludeClasses.includes(rasterFeature.attributes.ClassName)) {
            //const lcClass = new LandCoverClass(rasterFeature.attributes);
            // byValue.set(rasterFeature.attributes.Value, lcClass);
            byValue.set(rasterFeature.attributes.Value, {...rasterFeature.attributes});
          }
          return byValue;
        }, new Map());

      });

      /**
       *
       * @param {Extent} extent
       * @returns {Polygon}
       */
      this.fromExtent = extent => Polygon.fromExtent(extent);

    });
  }

  /**
   *
   * @param {Extent} extent
   * @param {Date} yearAsDate
   * @param {Point} pixelSize
   * @param {AbortSignal} abortSignal
   * @returns {Promise<CompareClassInfo>}
   */
  getHistogram({extent, yearAsDate, pixelSize, abortSignal}) {
    return new Promise((resolve, reject) => {
      require(['esri/core/promiseUtils'], (promiseUtils) => {

        this.imageryLayer.computeHistograms({
          geometry: this.fromExtent(extent),
          pixelSize: pixelSize,
          renderingRule: this.imageryLayer.renderingRule,
          mosaicRule: {method: "attribute", where: `(Year = ${ yearAsDate.getUTCFullYear() })`}
        }).then(histogramResults => {
          if (abortSignal && abortSignal.aborted) {
            reject(promiseUtils.createAbortError());
          } else {
            const classInfos = this.histogramToClassInfos(histogramResults.histograms[0]);
            resolve(classInfos);
          }
        }).catch(reject);
      });
    });
  };

  /**
   *
   * CONVERT HISTOGRAM INTO CLASS INFOS
   *
   * @param histogram
   * @returns {*}
   */
  histogramToClassInfos(histogram) {
    return histogram.counts.reduce((infos, count, value) => {
      if (this.classInfoByValue.has(value)) {
        const classInfo = this.classInfoByValue.get(value);
        return infos.set(value, {...classInfo, Count: count});
      } else { return infos; }
    }, this.clone());
  }

  /**
   *
   * @returns {Map<number, {}>}
   */
  clone() {
    return new Map(this.classInfoByValue);
  }

}

export default CompareClassInfo;
