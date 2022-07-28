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

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SignIn from './APL/SignIn.js';
import FeaturesList from './APL/FeaturesList.js';
import CompareClassInfos from './LandCoverChange/CompareClassInfos.js';

class Application extends AppBase {

  // PORTAL //
  portal;

  // SIGN IN //
  signIn;

  // MAX ZOOM LEVEL //
  maxZoomLevel = 10.0;

  /**
   * @type {CompareClassInfos}
   */
  compareClassInfos;

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // USER SIGN-IN //
        this.configUserSignIn();

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({map, group});

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').removeAttribute('active');
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {
    const signInContainer = document.getElementById('sign-in-container');
    if (signInContainer) {
      const signIn = new SignIn({container: signInContainer, portal: this.portal});
    }
  }

  /**
   *
   * @param view
   */
  configView(view) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/core/reactiveUtils',
          'esri/widgets/Expand',
          'esri/widgets/Home',
          'esri/widgets/Search'
        ], (reactiveUtils, Expand, Home, Search) => {

          //
          // CONFIGURE VIEW SPECIFIC STUFF HERE //
          //
          view.set({
            constraints: {snapToZoom: false}
          });

          // HOME //
          const home = new Home({view});
          view.ui.add(home, {position: 'top-left', index: 0});

          // SEARCH /
          const search = new Search({view: view});
          const searchExpand = new Expand({
            view, expanded: true, expandTooltip: "Search for place...", expandIconClass: "esri-icon-search", content: search
          });
          view.ui.add(searchExpand, {position: 'top-right', index: 0});

          // VIEW UPDATING //
          this.disableViewUpdating = false;
          const viewUpdating = document.getElementById('view-updating');
          view.ui.add(viewUpdating, 'bottom-right');
          reactiveUtils.watch(() => view.updating, (updating) => {
            (!this.disableViewUpdating) && viewUpdating.toggleAttribute('active', updating);
          });

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView(view).then(() => {

        this.initializeBookmarks({view});
        this.initializeAdminAreas({view});

        this.initializeSentinel2Layers({view}).then(({startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer}) => {

          this.initializeTimeSlider({view, startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer}).then(() => {

            this.initializeRenderers({view, startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer});

            this.initializeImageryDates({view, startImageryLayer, endImageryLayer});

            this.initializeSwipe({view, startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer});

            this.initializeComparisonAnalysis({view, startLandCoverLayer});

            this.initializeLocationInfo({view, startLandCoverLayer});

            this.initializeClassChart(view).then(resolve);

          }).catch(reject);
        }).catch(reject);
      }).catch(reject);

    });
  }

  /**
   *
   * @param view
   */
  initializeBookmarks({view}) {
    require(['esri/widgets/Bookmarks'], (Bookmarks) => {

      // BOOKMARKS //
      const bookmarks = new Bookmarks({container: 'bookmarks-container', view: view});

    });
  }

  /**
   *
   * @param view
   */
  initializeAdminAreas({view}) {

    // URBAN AREAS //
    const urbanAreasLayer = view.map.allLayers.find(layer => layer.title === 'World Urban Areas');
    urbanAreasLayer.load().then(() => {

      /**
       *
       * @type {FeaturesList}
       */
      const featureListUrbanAreas = new FeaturesList({
        container: 'feature-list-urban-areas',
        view,
        selectActivity: FeaturesList.ACTIVITY.GOTO,
        actionActivity: FeaturesList.ACTIVITY.NONE
      });
      featureListUrbanAreas.initialize({
        featureLayer: urbanAreasLayer,
        queryParams: {
          outFields: ['FID', 'Name', 'ISO_CC', 'RANK'],
          orderByFields: ['RANK ASC', 'Name ASC']
        },
        getFeatureInfoCallback: (feature) => {
          const value = String(feature.getObjectId());
          const label = `${ feature.attributes.Name }, ${ feature.attributes.ISO_CC }`;
          const description = `[${ feature.attributes.RANK }] Urban Area`;
          return {label, description, value};
        }
      });

    });
  }

  /**
   *
   * @param view
   * @returns {Promise<{startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer}>}
   */
  initializeSentinel2Layers({view}) {
    return new Promise((resolve, reject) => {

      const startLandCoverLayer = view.map.layers.find(layer => layer.title === 'Sentinel-2 10m Land Cover - Before');
      const endLandCoverLayer = view.map.layers.find(layer => layer.title === 'Sentinel-2 10m Land Cover - After');
      const startImageryLayer = view.map.layers.find(layer => layer.title === 'Sentinel-2 Level-2A - Before');
      const endImageryLayer = view.map.layers.find(layer => layer.title === 'Sentinel-2 Level-2A - After');

      Promise.all([
        startLandCoverLayer.load(),
        endLandCoverLayer.load(),
        startImageryLayer.load(),
        endImageryLayer.load()
      ]).then(() => {

        // Possible Values: "png"|"png8"|"png24"|"png32"|"jpg"|"bmp"|"gif"|"jpgpng"|"lerc"|"tiff"
        const imageFormat = 'png32';

        const defaultOptions = {
          format: imageFormat,
          mosaicRule: null,
          useViewTime: false
        };

        startLandCoverLayer.set(defaultOptions);
        endLandCoverLayer.set(defaultOptions);
        startImageryLayer.set(defaultOptions);
        endImageryLayer.set(defaultOptions);

        let _displayType = 'land-cover';
        let _swipeEnabled = false;

        const _updateLayerVisibility = () => {
          startLandCoverLayer.visible = (_displayType === 'land-cover');
          endLandCoverLayer.visible = _swipeEnabled && (_displayType === 'land-cover');
          startImageryLayer.visible = (_displayType === 'imagery');
          endImageryLayer.visible = _swipeEnabled && (_displayType === 'imagery');
        };

        this.addEventListener('display-type-change', ({detail: {displayType}}) => {
          _displayType = displayType;
          _updateLayerVisibility();
        });

        this.addEventListener('swipe-enabled-change', ({detail: {swipeEnabled}}) => {
          _swipeEnabled = swipeEnabled;
          _updateLayerVisibility();
        });

        resolve({startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer});
      });

    });
  }

  /**
   *
   * @param {MapView} view
   * @param {string} bookmarkName
   * @returns {Promise}
   */
  zoomToInitialExtent({view, bookmarkName}) {
    return new Promise((resolve, reject) => {
      const oregonBookmark = view.map.bookmarks.find(bookmark => bookmark.name === bookmarkName);
      view.goTo({target: oregonBookmark.viewpoint}).then(resolve);
    });
  }

  /**
   *
   * @param view
   * @param startImageryLayer
   * @param endImageryLayer
   */
  initializeImageryDates({view, startImageryLayer, endImageryLayer}) {
    require([
      'esri/core/reactiveUtils',
      'esri/core/promiseUtils'
    ], (reactiveUtils, promiseUtils) => {

      const getIdentifyParams = layer => {
        return {
          geometry: view.center,
          maxItemCount: 1,
          mosaicRule: layer.mosaicRule,
          returnCatalogItems: true
        };
      };

      const getCurrentDates = promiseUtils.debounce((abortSignal) => {
        return new Promise((resolve, reject) => {
          showLoading(true);
          Promise.all([
            startImageryLayer.identify(getIdentifyParams(startImageryLayer), {signal: abortSignal}),
            endImageryLayer.identify(getIdentifyParams(endImageryLayer), {signal: abortSignal})
          ]).then(([startIdentifyResults, endIdentifyResults]) => {
            showLoading(false);
            if (abortSignal?.aborted) {
              reject(promiseUtils.createAbortError());
            } else {
              if (startIdentifyResults.catalogItems.features.length) {
                resolve({
                  startDate: startIdentifyResults.catalogItems.features[0].attributes.acquisitiondate,
                  endDate: endIdentifyResults.catalogItems.features[0].attributes.acquisitiondate
                });
              } else {
                reject(new Error("No imagery at this location..."));
              }
            }
          }).catch(reject);
        });
      });

      const handleError = error => {
        if (error.name !== "AbortError") {console.error(error);}
      };

      const dateFormatter = new Intl.DateTimeFormat('default', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'});
      const toDisplayDate = (dateValue) => {
        return dateFormatter.format(new Date(dateValue));
      };

      const imageryDateStartAction = document.getElementById('imagery-date-start-action');
      const imageryDateEndAction = document.getElementById('imagery-date-end-action');
      const showLoading = (loading) => {
        imageryDateStartAction.toggleAttribute('loading', loading);
        imageryDateEndAction.toggleAttribute('loading', loading);
      };

      const imageryDateStart = document.getElementById('imagery-date-start');
      const imageryDateEnd = document.getElementById('imagery-date-end');
      const updateImageryDates = ({startDate, endDate}) => {
        imageryDateStart.setAttribute('description', startDate ? toDisplayDate(startDate) : '...');
        imageryDateEnd.setAttribute('description', endDate ? toDisplayDate(endDate) : '...');
      };

      // ABORT CONTROLLER //
      let abortController;

      reactiveUtils.watch(() => view.stationary, (stationary) => {
        if (displayTypeIsImagery && stationary) {
          abortController?.abort();
          abortController = new AbortController();
          getCurrentDates(abortController.signal).then(updateImageryDates).catch(handleError);
        } else {
          showLoading(false);
          updateImageryDates({});
        }
      });

      // UPDATE LABELS //
      this.addEventListener("time-extent-change", ({detail: {}}) => {
        if (displayTypeIsImagery) {
          abortController?.abort();
          abortController = new AbortController();
          getCurrentDates(abortController.signal).then(updateImageryDates).catch(handleError);
        } else {
          showLoading(false);
          updateImageryDates({});
        }
      });

      let displayTypeIsImagery = false;
      this.addEventListener('display-type-change', ({detail: {displayType}}) => {
        displayTypeIsImagery = (displayType === 'imagery');
        if (displayTypeIsImagery) {
          abortController?.abort();
          abortController = new AbortController();
          getCurrentDates(abortController.signal).then(updateImageryDates).catch(handleError);
        } else {
          showLoading(false);
          updateImageryDates({});
        }
      });

    });
  }

  /**
   *
   * @param view
   * @param startLandCoverLayer
   */
  initializeComparisonAnalysis({view, startLandCoverLayer}) {
    require([
      'esri/core/reactiveUtils',
      'esri/core/promiseUtils'
    ], (reactiveUtils, promiseUtils) => {

      //
      // UPDATE ANALYSIS
      //
      const updateAnalysis = promiseUtils.debounce(({abortSignal}) => {
        return new Promise((resolve, reject) => {

          const validScale = (view.zoom > this.maxZoomLevel);
          if (validScale) {

            const startDate = this.timeSlider.timeExtent.start;
            const endDate = this.timeSlider.timeExtent.end;
            const renderingRule = startLandCoverLayer.renderingRule;

            // COMPARE CLASS INFOS //
            this.compareClassInfos.compareClassChange({startDate, endDate, renderingRule, abortSignal}).then(({changeClassInfo}) => {
              if (abortSignal?.aborted) {
                this.clearClassChart();
                reject(promiseUtils.createAbortError());
              } else {
                this.updateClassChart(changeClassInfo, view.resolution);
                resolve();
              }
            }).catch(reject);
          } else {
            this.clearClassChart();
            reject(promiseUtils.createAbortError());
          }
        });
      });

      const handleError = error => {
        if (error.name !== "AbortError") {console.error(error);}
      };

      // ABORT CONTROLLER //
      let abortController;

      // VIEW EXTENT CHANGE //
      reactiveUtils.watch(() => view.extent, () => {
        abortController?.abort();
        reactiveUtils.whenOnce(() => view.stationary).then(() => {
          abortController = new AbortController();
          updateAnalysis({abortSignal: abortController.signal}).catch(handleError);
        });
      });

      // TIME EXTENT CHANGED //
      this.addEventListener('time-extent-change', () => {
        abortController?.abort();
        abortController = new AbortController();
        updateAnalysis({abortSignal: abortController.signal}).catch(handleError);
      });

      // RENDERING CHANGED //
      this.addEventListener("rendering-change", () => {
        abortController?.abort();
        abortController = new AbortController();
        updateAnalysis({abortSignal: abortController.signal}).catch(handleError);
      });

    });
  }

  /**
   *
   * @param view
   * @param startLandCoverLayer
   * @param endLandCoverLayer
   * @param startImageryLayer
   * @param endImageryLayer
   */
  initializeTimeSlider({view, startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer}) {
    return new Promise((resolve, reject) => {
      require([
        'esri/core/reactiveUtils',
        'esri/widgets/TimeSlider'
      ], (reactiveUtils, TimeSlider) => {

        const createTimeExtentByYear = yearDate => {
          return {start: yearDate, end: yearDate};
        };

        const createMosaicRuleByYear = yearDate => {
          return {
            method: `attribute`,
            where: `(category = 2) OR (CloudCover < 0.1)`,
            sortField: `AcquisitionDate`,
            sortValue: `${ yearDate.getUTCFullYear() }/09/01`,
            ascending: true
          };
        };

        // GET AVAILABLE DATES FROM SERVICE //
        startLandCoverLayer.queryRasters().then(rasterFS => {
          // YEARS //
          const years = rasterFS.features.map(feature => {
            return new Date(feature.attributes.StartDate);
          });

          // FULL TIME EXTENT //
          this.fullTimeExtent = {
            start: years[0], end: years[years.length - 1]
          };

          // TIME SLIDER //
          this.timeSlider = new TimeSlider({
            container: "time-slider-container",
            mode: "time-window",
            playRate: 1500,
            fullTimeExtent: this.fullTimeExtent,
            stops: {dates: years},
            tickConfigs: [{
              mode: "position",
              values: years,
              labelsVisible: true,
              labelFormatFunction: (value) => {
                return (new Date(value)).getUTCFullYear();
              }
            }]
          });

          reactiveUtils.watch(() => this.timeSlider.timeExtent, timeExtent => {

            // SET TIME EXTENT FOR EACH LAYER //
            startLandCoverLayer.timeExtent = createTimeExtentByYear(timeExtent.start);
            endLandCoverLayer.timeExtent = createTimeExtentByYear(timeExtent.end);
            startImageryLayer.mosaicRule = createMosaicRuleByYear(timeExtent.start);
            endImageryLayer.mosaicRule = createMosaicRuleByYear(timeExtent.end);

            this.dispatchEvent(new CustomEvent('time-extent-change', {detail: {timeExtent}}));
          });

          resolve();
        });
      });
    });
  }

  /**
   *
   * @param view
   * @param startLandCoverLayer
   * @param endLandCoverLayer
   * @param startImageryLayer
   * @param endImageryLayer
   */
  initializeSwipe({view, startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer}) {
    require(['esri/core/reactiveUtils', 'esri/widgets/Swipe'], (reactiveUtils, Swipe) => {

      const swipe = new Swipe({
        id: 'swipe',
        view: view,
        leadingLayers: [startImageryLayer, startLandCoverLayer],
        trailingLayers: [endImageryLayer, endLandCoverLayer],
        direction: "horizontal",
        position: 50
      });
      view.ui.add(swipe);

      swipe.when(() => {

        // INITIAL START AND END YEARS //
        const startYear = this.timeSlider.timeExtent.start.getUTCFullYear();
        const endYear = this.timeSlider.timeExtent.end.getUTCFullYear();

        // GET SWIPE CONTAINER //
        const swipeContainer = document.querySelector(".esri-swipe__container");

        // ADD SWIPE LABEL //
        const swipeLabelContainer = document.createElement('div');
        swipeLabelContainer.classList.add('swipe-label-container');
        swipeContainer.after(swipeLabelContainer);

        const leadingLabel = document.createElement('div');
        leadingLabel.classList.add('swipe-label');
        leadingLabel.innerHTML = startYear;
        const trailingLabel = document.createElement('div');
        trailingLabel.classList.add('swipe-label');
        trailingLabel.innerHTML = endYear;
        swipeLabelContainer.append(leadingLabel, trailingLabel);

        // UPDATE POSITION //
        let _position = swipe.position;
        reactiveUtils.watch(() => swipe.position, (position) => {
          _position = position;
          swipeLabelContainer.style.left = `calc(${ position }% - 80px)`;
        });

        // UPDATE LABELS //
        this.addEventListener("time-extent-change", ({detail: {timeExtent}}) => {
          leadingLabel.innerHTML = timeExtent.start.getUTCFullYear();
          trailingLabel.innerHTML = timeExtent.end.getUTCFullYear();
        });

        // SCALE //
        const scaleFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 0, maximumFractionDigits: 0});
        const scaleLabel = document.createElement('div');
        scaleLabel.innerHTML = '';
        scaleLabel.toggleAttribute('hidden');

        const scaleWarning = document.createElement('calcite-action');
        scaleWarning.setAttribute('icon', 'exclamation-mark-triangle-f');
        scaleWarning.setAttribute('text', 'Zoom in to compare land cover change...');
        scaleWarning.toggleAttribute('text-enabled');
        scaleWarning.toggleAttribute('hidden');
        scaleWarning.addEventListener('click', () => {
          view.goTo({zoom: (this.maxZoomLevel + 1.0)});
        });

        const scaleContainer = document.createElement('div');
        scaleContainer.classList.add('scale-label');
        scaleContainer.replaceChildren(scaleLabel, scaleWarning);
        view.ui.add(scaleContainer, 'bottom-left');

        const zoomUpdated = () => {
          const validScale = (view.zoom > this.maxZoomLevel);

          scaleWarning.toggleAttribute('hidden', validScale);
          scaleLabel.toggleAttribute('hidden', !validScale);
          scaleLabel.innerHTML = validScale ? `1:${ scaleFormatter.format(view.scale) }` : '';

          const inViewUI = (view.ui.find('swipe') != null);
          if (validScale) {
            if (!inViewUI) {
              view.ui.add(swipe);
              swipe.view = view;
              this.dispatchEvent(new CustomEvent('swipe-enabled-change', {detail: {swipeEnabled: true}}));
            }
          } else {
            if (inViewUI) {
              view.ui.remove(swipe);
              swipe.view = null;
              this.dispatchEvent(new CustomEvent('swipe-enabled-change', {detail: {swipeEnabled: false}}));
            }
          }
        };

        reactiveUtils.whenOnce(() => view.extent).then(() => {
          zoomUpdated();
          reactiveUtils.watch(() => view.zoom, zoomUpdated, {initial: false});
        });

      });

    });
  }

  /**
   *
   * @param view
   * @param startLandCoverLayer
   * @returns {Promise<>}
   */
  initializeLocationInfo({view, startLandCoverLayer}) {
    return new Promise((resolve, reject) => {
      require([
        'esri/Color',
        'esri/Graphic',
        'esri/layers/GraphicsLayer',
        'esri/core/promiseUtils'
      ], (Color, Graphic, GraphicsLayer, promiseUtils) => {

        const locationGraphic = new Graphic({
          symbol: {
            type: "web-style",
            name: "esri-pin-2",
            styleName: "Esri2DPointSymbolsStyle"
          }
        });
        const locationLayer = new GraphicsLayer({title: "Location Layer", graphics: [locationGraphic]});
        view.map.add(locationLayer);

        const startField = startLandCoverLayer.timeInfo.startField;
        const endField = startLandCoverLayer.timeInfo.endField;

        const noDataClass = {ClassName: "No Data", Red: 192, Green: 192, Blue: 192};

        this.getLocationInfo = promiseUtils.debounce(location => {
          return new Promise((getLocationResolve, getLocationReject) => {
            if (location) {

              const compareClassInfo = this.compareClassInfos.getCompareClassInfo(startLandCoverLayer.renderingRule.functionName);

              startLandCoverLayer.identify({
                geometry: location,
                timeExtent: startLandCoverLayer.timeInfo.fullTimeExtent,
                returnGeometry: false,
                returnPixelValues: true,
                returnCatalogItems: true
              }).then((identifyResult) => {

                // CLASS VALUES //
                const classValues = identifyResult.properties.Values;

                // CLASS INFOS //
                const classInfos = identifyResult.catalogItems.features.map((feature, featureIdx) => {
                  //console.info(feature.attributes);

                  const classValue = classValues[featureIdx];
                  const classInfo = (classValue !== "NoData") ? compareClassInfo.classInfoByValue.get(Number(classValue)) : noDataClass;

                  return {
                    productName: feature.attributes.ProductName,
                    startYear: (new Date(feature.attributes[startField])).getUTCFullYear(),
                    endYear: (new Date(feature.attributes[endField])).getUTCFullYear(),
                    landCover: classInfo.ClassName,
                    classValue: classValue,
                    color: new Color([classInfo.Red, classInfo.Green, classInfo.Blue])
                  };

                });
                // CLASS INFOS SORTED BY YEAR //
                classInfos.sort((a, b) => {
                  if (a.startYear === b.startYear) {
                    return (a.endYear - b.endYear);
                  } else {
                    return (a.startYear - b.startYear);
                  }
                });

                const allYearsInfos = classInfos.map(classInfo => {
                  return `${ classInfo.startYear } to ${ classInfo.endYear }: ${ classInfo.landCover }`;
                });

                // CONFLATE BY START & END YEARS //
                const groupedByYearsInfos = classInfos.reduce((infos, classInfo, classInfoIdx) => {
                  if (classInfoIdx === 0) {
                    infos.push(classInfo);
                  } else {
                    const lastInfo = infos[infos.length - 1];
                    if ((classInfo.landCover === lastInfo.landCover) && (classInfo.startYear === (lastInfo.endYear + 1))) {
                      lastInfo.endYear = classInfo.endYear;
                    } else {
                      infos.push(classInfo);
                    }
                  }
                  return infos;
                }, []);

                // CALC YEAR INFOS //
                groupedByYearsInfos.forEach(classInfo => {
                  classInfo.yearInfo = (classInfo.startYear !== classInfo.endYear)
                    ? `${ classInfo.startYear } to ${ classInfo.endYear }`
                    : classInfo.startYear;
                });

                getLocationResolve({groupedByYearsInfos: groupedByYearsInfos, allYearsInfos: allYearsInfos});
              });
            } else {
              getLocationReject();
            }
          });
        });

        const locationChangeAnalysis = (clickEvt) => {
          const location = clickEvt?.mapPoint;

          locationGraphic.geometry = location;
          locationLonInput.value = location ? coordsFormatter.format(locationGraphic.geometry.longitude) : null;
          locationLatInput.value = location ? coordsFormatter.format(locationGraphic.geometry.latitude) : null;

          if (location) {
            this.getLocationInfo(location).then(locationInfos => {
              const byYearsInfoNodes = locationInfos.groupedByYearsInfos.map(locationInfo => {

                const byYearsInfoNode = document.createElement('calcite-list-item');
                byYearsInfoNode.setAttribute('label', locationInfo.landCover);
                byYearsInfoNode.setAttribute('description', locationInfo.yearInfo);
                byYearsInfoNode.setAttribute('data-class', locationInfo.landCover);
                byYearsInfoNode.toggleAttribute('non-interactive', true);

                return byYearsInfoNode;
              });
              locationDetailsPanel.replaceChildren(...byYearsInfoNodes);
            });
          } else {
            locationDetailsPanel.replaceChildren();
          }
        };

        const locationDetailsPanel = document.getElementById('location-details-panel');
        const locationLonInput = document.getElementById('location-lon-input');
        const locationLatInput = document.getElementById('location-lat-input');
        const coordsFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 4, maximumFractionDigits: 4});

        let viewClickHandle;
        const analysisLocationBtn = document.getElementById('analysis-location-btn');
        analysisLocationBtn.addEventListener('click', () => {

          const isActive = analysisLocationBtn.toggleAttribute('active');
          analysisLocationBtn.setAttribute('appearance', isActive ? 'solid' : 'outline');
          analysisLocationBtn.setAttribute('icon-end', isActive ? 'check' : 'blank');
          view.container.style.cursor = isActive ? 'crosshair' : 'default';

          if (isActive) {
            viewClickHandle = view.on("click", locationChangeAnalysis);
          } else {
            locationChangeAnalysis();
            viewClickHandle.remove();
            viewClickHandle = null;
          }
        });

        resolve();
      });
    });
  }

  /**
   *
   *  https://chartjs-plugin-datalabels.netlify.app/
   *
   * @param view
   */
  initializeClassChart({view}) {
    return new Promise((resolve, reject) => {

      const tickFormatter = (value, index, values) => {
        const labelInfo = {label: Math.fround(value).toLocaleString(), unit: ''};
        switch (true) {
          case (Math.abs(value) >= 1000000):
            labelInfo.label = Math.fround(value / 1000000).toLocaleString();
            labelInfo.unit = 'M';
            break;
          case (Math.abs(value) >= 1000):
            labelInfo.label = Math.fround(value / 1000).toLocaleString();
            labelInfo.unit = 'K';
            break;
        }
        return `${ labelInfo.label } ${ labelInfo.unit }`;
      };

      const shortenLongClassName = info => {
        return [info.y.toUpperCase(), info.changeLabel];
      };

      const splitLongClassName = tooltipItem => {

        const className = tooltipItem[0].label;
        let max = 24;

        if ((className.indexOf(' ') === -1) || (className.length < max)) {
          return className;
        } else {

          const parts = className.split(' ');
          return parts.reduce((label, part) => {
            if (label.length > max) {
              label = `${ label }\n`;
              max = (label.length + 30);
            }
            return `${ label } ${ part }`;
          }, '');
        }
      };

      const equalizeAxisRange = (xAxes) => {
        if (xAxes.min < 0) {
          const absMax = Math.max(Math.abs(xAxes.min), Math.abs(xAxes.max));
          xAxes.min = -absMax;
          xAxes.max = absMax;
        } else {
          xAxes.min = -xAxes.max;
        }
      };

      const barBorderWidth = (context) => {
        const data = context.dataset.data;
        return data.length ? ((data[context.dataIndex].x > 0) ? {left: 1.0} : {right: 1.0}) : 0.0;
      };

      const calcHorizontalAnchor = (context) => {
        return (context.dataset.data[context.dataIndex].x > 0) ? 'start' : 'end';
      };

      const calcHorizontalAlign = (context) => {
        return (context.dataset.data[context.dataIndex].x > 0) ? 'start' : 'end';
      };

      const calcHorizontalTextAlign = (context) => {
        return (context.dataset.data[context.dataIndex].x > 0) ? 'end' : 'start';
      };

      const tooltipLabelCallback = (tooltipItem) => {
        return tooltipItem.raw.tooltip;
      };

      const alignAlongX = (evt) => {
        return (evt.tooltip.dataPoints[0].raw.x > 0) ? 'left' : 'right';
      };

      Chart.register(ChartDataLabels);
      Chart.defaults.color = '#ededed';
      Chart.defaults.font = {family: "'Avenir Next LT Pro','sans-serif'", style: 'normal', size: 12};

      const chartNode = document.getElementById('chart-node');
      const landcoverChart = new Chart(chartNode, {
        type: 'bar',
        data: {
          datasets: [{
            data: [],
            borderColor: [],
            backgroundColor: [],
            borderWidth: 2.5,
            datalabels: {
              formatter: shortenLongClassName,
              anchor: calcHorizontalAnchor,
              align: calcHorizontalAlign,
              textAlign: calcHorizontalTextAlign,
              clip: false,
              clamp: true
            }
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            datalabels: {
              color: '#efefef',
              backgroundColor: 'rgba(43,43,43,0.5)',
              font: {
                family: "'Avenir Next LT Pro','sans-serif'",
                size: 13,
                weight: '600'
              }
            },
            title: {
              display: true,
              text: ' ',
              font: {size: 16, style: 'normal'}
            },
            tooltip: {
              enabled: true,
              titleFont: {size: 15},
              bodyFont: {size: 14},
              position: 'nearest',
              xAlign: alignAlongX,
              callbacks: {
                title: splitLongClassName,
                label: tooltipLabelCallback
              }
            },
            legend: {display: false}
          },
          indexAxis: 'y',
          scales: {
            y: {display: false},
            x: {
              title: {
                display: true,
                text: 'Approximate Change in Acres',
                font: {size: 13, style: 'italic'}
              },
              afterDataLimits: equalizeAxisRange,
              ticks: {
                color: '#efefef',
                callback: tickFormatter
              },
              grid: {
                color: '#666666',
                borderColor: '#666666',
                borderWidth: 2
              }
            }
          }
        }
      });

      const acrePerSqMeter = 0.000247105;
      const cellsToAcre = (pixelSizeMeters) => {
        return (pixelSizeMeters * pixelSizeMeters) * acrePerSqMeter;
      };

      this.clearClassChart = () => {

        landcoverChart.options.plugins.title.text = `Zoom in to compare land cover change...`;
        landcoverChart.data.labels = [];
        landcoverChart.data.datasets[0].data = [];
        landcoverChart.data.datasets[0].borderColor = [];
        landcoverChart.data.datasets[0].backgroundColor = [];
        landcoverChart.update();

      };

      const acresFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 0, maximumFractionDigits: 0});

      this.updateClassChart = (changeClassInfo, pixelSizeMeters) => {
        //console.info(changeClassInfo);

        const startYear = this.timeSlider.timeExtent.start.getUTCFullYear();
        const endYear = this.timeSlider.timeExtent.end.getUTCFullYear();

        const acresPerPixel = cellsToAcre(pixelSizeMeters);

        const labels = [];
        const data = [];
        const borderColors = [];
        const backgroundColors = [];
        changeClassInfo.forEach(classInfo => {

          const changeAcres = (classInfo.ChangeCount * acresPerPixel);
          const changeMsg = (changeAcres > 0.0) ? 'gain' : 'loss';
          const absChange = Math.abs(changeAcres);

          const changeLabel = `${ changeMsg } of ~${ acresFormatter.format(absChange) } acres`;
          const tooltipLabel = [`${ startYear }: ~${ acresFormatter.format(classInfo.StartCount * acresPerPixel) } acres`, `${ endYear }: ~${ acresFormatter.format(classInfo.EndCount * acresPerPixel) } acres`];

          if (absChange > 10.0) { // 100.0
            labels.push(classInfo.ClassName);
            data.push({
              x: changeAcres,
              y: classInfo.ClassName,
              label: classInfo.ClassName,
              tooltip: tooltipLabel,
              changeLabel: changeLabel
            });
            borderColors.push(`rgb(${ classInfo.Red },${ classInfo.Green },${ classInfo.Blue })`);
            backgroundColors.push(`rgba(${ classInfo.Red },${ classInfo.Green },${ classInfo.Blue },0.6)`);
          }
        });

        landcoverChart.options.plugins.title.text = `${ startYear } to ${ endYear }`;
        landcoverChart.data.labels = labels;
        landcoverChart.data.datasets[0].data = data;
        landcoverChart.data.datasets[0].borderColor = borderColors;
        landcoverChart.data.datasets[0].backgroundColor = backgroundColors;
        landcoverChart.update();
      };

      resolve();
    });
  }

  /**
   *
   * @param view
   * @param startLandCoverLayer
   * @param endLandCoverLayer
   * @param startImageryLayer
   * @param endImageryLayer
   */
  initializeRenderers({view, startLandCoverLayer, endLandCoverLayer, startImageryLayer, endImageryLayer}) {

    const excludeClasses = ['No Data', 'Clouds'];

    this.compareClassInfos = new CompareClassInfos({view, imageryLayer: startLandCoverLayer, excludeClasses});
    this.compareClassInfos.addEventListener('ready', ({}) => {

      const rasterFunctionsList = document.getElementById('raster-functions-list');
      this.compareClassInfos.createListItems({listNode: rasterFunctionsList});

      rasterFunctionsList.addEventListener('calciteListChange', ({detail}) => {
        const rasterFunctionName = detail.keys().next().value;
        startLandCoverLayer.renderingRule = {functionName: rasterFunctionName};
        endLandCoverLayer.renderingRule = {functionName: rasterFunctionName};
        this.dispatchEvent(new CustomEvent('rendering-change', {detail: {rasterFunctionName}}));
      });

      const analysisTypeOption = document.getElementById('analysis-type-option');
      analysisTypeOption.addEventListener('calciteTabChange', ({detail: {tab}}) => {
        this.dispatchEvent(new CustomEvent('display-type-change', {detail: {displayType: tab}}));
      });

    });
  }

}

export default new Application();
