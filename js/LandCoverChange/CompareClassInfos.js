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
import CompareClassInfo from './CompareClassInfo.js';

/**
 *
 * CompareClassInfos
 *  - Compare Class Infos
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  7/1/2022 - 0.0.1 -
 * Modified:
 *
 */

class CompareClassInfos extends EventTarget {

  static version = '0.0.1';

  /**
   @type {MapView}
   */
  view;

  /**
   * @type {ImageryLayer}
   */
  imageryLayer;

  /**
   * @type {Map<string,CompareClassInfo>}
   */
  compareClassInfos;

  /**
   *
   * @param {MapView} view
   * @param {ImageryLayer} imageryLayer
   * @param {string[]} excludeClasses
   */
  constructor({view, imageryLayer, excludeClasses = []}) {
    super();

    this.view = view;
    this.imageryLayer = imageryLayer;
    this.excludeClasses = excludeClasses;

    this.imageryLayer.load().then(() => {
      this.initialize();
    });

  }

  /**
   *
   */
  initialize() {
    require(["esri/core/reactiveUtils"], (reactiveUtils) => {

      reactiveUtils.whenOnce(() => this.imageryLayer.rasterFunctionInfos !== undefined).then(() => {

        const validRasterFunctionInfos = this.imageryLayer.rasterFunctionInfos.filter(rfInfo => {
          return (rfInfo.name !== 'None');
        });

        this.compareClassInfos = validRasterFunctionInfos.reduce((list, rasterFunctionInfo) => {

          const compareClassInfo = new CompareClassInfo({
            imageryLayer: this.imageryLayer,
            excludeClasses: this.excludeClasses,
            rasterFunctionInfo: rasterFunctionInfo
          });

          return list.set(rasterFunctionInfo.name, compareClassInfo);
        }, new Map());

        this.dispatchEvent(new CustomEvent('ready', {detail: {}}));

      });

    });
  }

  /**
   *
   * @param {HTMLElement} listNode
   */
  createListItems({listNode}) {

    this.compareClassInfos.forEach((compareClassInfo, name) => {

      const listItemNode = document.createElement('calcite-pick-list-item');
      listItemNode.setAttribute('value', name);
      listItemNode.setAttribute('label', name);
      listItemNode.setAttribute('description', compareClassInfo.rasterFunctionInfo.description);
      listItemNode.toggleAttribute('selected', listNode.children.length === 0);

      listNode.append(listItemNode);
    });

  }

  /**
   *
   * @param {string} rasterFunctionName
   * @returns {CompareClassInfo}
   */
  getCompareClassInfo(rasterFunctionName) {
    return this.compareClassInfos.get(rasterFunctionName);
  }

  /**
   *
   * @returns {Point}
   */
  getPixelSize() {
    return {
      x: this.view.resolution, y: this.view.resolution,
      spatialReference: {wkid: this.view.spatialReference.wkid}
    };
  };

  /**
   *
   * @param startDate
   * @param endDate
   * @param renderingRule
   * @param abortSignal
   */
  compareClassChange({startDate, endDate, renderingRule, abortSignal = null}) {
    return new Promise((resolve, reject) => {
      require(['esri/core/reactiveUtils', 'esri/core/promiseUtils'], (reactiveUtils, promiseUtils) => {

        // CURRENT PIXEL SIZE //
        const pixelSize = this.getPixelSize();
        // VIEW EXTENT //
        const viewExtent = this.view.extent;

        // COMPARE CLASS INFO //
        const compareClassInfo = this.compareClassInfos.get(renderingRule.functionName);

        Promise.all([
          compareClassInfo.getHistogram({extent: viewExtent, pixelSize, yearAsDate: startDate, abortSignal}),
          compareClassInfo.getHistogram({extent: viewExtent, pixelSize, yearAsDate: endDate, abortSignal})
        ]).then(([startClassInfo, endClassInfo]) => {
          if (abortSignal?.aborted) {
            reject(promiseUtils.createAbortError());

          } else {

            const changeClassInfo = compareClassInfo.clone();
            changeClassInfo.forEach(classInfo => {
              const startCount = startClassInfo.get(classInfo.Value).Count;
              const endCount = endClassInfo.get(classInfo.Value).Count;

              // const doesNotApply = (startCount === 0) && (endCount === 0);
              // console.assert(!doesNotApply, "DOES NOT APPLY: ", classInfo.ClassName, startCount, endCount);
              // const onlyLoss = (startCount > 0) && (endCount === 0);
              // const onlyGain = (startCount === 0) && (endCount > 0);
              //console.assert(!onlyLoss, "ONLY LOSS: ", classInfo.ClassName, startCount, endCount);
              //console.assert(!onlyGain, "ONLY GAIN: ", classInfo.ClassName, startCount, endCount);

              classInfo.StartCount = startCount;
              classInfo.EndCount = endCount;
              classInfo.ChangeCount = (endCount - startCount);

              changeClassInfo.set(classInfo.Value, classInfo);
            });

            resolve({changeClassInfo});
          }
        }).catch(reject);
      });
    });
  }

}

export default CompareClassInfos;
