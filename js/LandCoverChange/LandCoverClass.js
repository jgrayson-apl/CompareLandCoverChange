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
 * LandCoverClass
 *  - Land Cover Class
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  7/13/2022 - 0.0.1 -
 * Modified:
 *
 */

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

class LandCoverClass {

  static version = '0.0.1';

  /**
   * @type {string}
   */
  ClassName;

  /**
   * @type {string}
   */
  Description;

  /**
   * @type {string}
   */
  Examples;

  /**
   * @type {string}
   */
  PopupText;

  /**
   * @type {string}
   */
  UlcPopupText;

  /**
   * @type {number}
   */
  Red;

  /**
   * @type {number}
   */
  Green;

  /**
   * @type {number}
   */
  Blue;

  /**
   * @type {number}
   */
  Value;

  /**
   * @type {number}
   */
  Count;

  /**
   *
   * @param params
   */
  constructor(params) {
    Object.assign(this, params);
    this.Count = 0;
  }

  /**
   *
   * @param  {LandCoverClass} other
   * @returns {number|null}
   */
  compare(other) {
    if (other.Value === this.Value) {
      return (this.Count - other.Count);
    } else {
      console.error("Invalid Land Cover Class: ClassName are not the same");
      return null;
    }
  }

}

export default LandCoverClass;
