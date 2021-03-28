const {
    Component,
    ListOf,
    Record,
    Store,
} = window.Torus;
const html = window.jdom;

const PROPERTY_TYPES = [{
    name: 'Aggregate Stone',
    color: 'rgb(31, 78, 120)',
    textColor: '#000',
}, {
    name: 'Lime Stone',
    color: 'rgb(255, 217, 0)',
    textColor: '#000',
}, {
    name: 'Black Granite',
    color: 'rgb(131, 60, 12)',
    textColor: '#000',
}, {
    name: 'Quartz',
    color: 'rgb(222, 132, 169)',
    textColor: '#000',
}];

function removeFromArray(arr, item) {
    if (arr.includes(item)) {
        arr.splice(arr.indexOf(item), 1);
    }
    return arr;
}

function getIndicatorColor(property) {
    const propertyType = property.get('PROPERTY_TYPE');
    const indicator = property.get('INSPECTION_INDICATOR');

    // if (indicator == 'V') {
    //     return '#eb5065';
    // }

    for (const { name, color }
        of PROPERTY_TYPES) {
        if (propertyType.includes(name)) {
            return color;
        }
    }

    return 'rgb(220, 220, 220)';
}

const processPoints = (geometry, callback) => {
    if (geometry instanceof google.maps.LatLng) {
        callback(geometry);
    } else if (geometry instanceof google.maps.Data.Point) {
        callback(geometry.get());
    } else {
        geometry.getArray().forEach(g => {
            processPoints(g, callback);
        });
    }
}

const BOUNDARY_STYLES = {
    hybrid: {
        fillColor: '#bbbbbb',
        strokeColor: 'e0e0e0',
        strokeWeight: 1,
        zIndex: 100,
    },
    satellite: {
        fillColor: '#bbbbbb',
        strokeColor: 'e0e0e0',
        strokeWeight: 1,
        zIndex: 100,
    },
    default: {
        fillColor: '#aaaaaa',
        strokeColor: '#888888',
        strokeWeight: 1,
        zIndex: 100,
    },
    highlighted: {
        fillColor: '#fff',
        strokeColor: '#fff',
        strokeWeight: 1,
    },
    geo: {
        fillColor: 'rgba(220, 220, 220, 0.4)',
        strokeColor: 'rgb(80, 144, 220)',
        strokeWeight: 2,
    },
};

function getBoundaryStyles(mapTypeId) {
    if (mapTypeId in BOUNDARY_STYLES) {
        return BOUNDARY_STYLES[mapTypeId];
    } else {
        return BOUNDARY_STYLES.default;
    }
}

/**
 * Takes "78 RANDOM STREET,CITY,DISTRICT DISTRICT"
 * returns "78 Random Street, City, District District"
 */
function titleCase(s) {
    return s.split(',')
        .map(s => s.trim())
        .filter(s => !!s)
        .map(s => s.split(' ')
            .filter(w => !!w)
            .map(w => w[0] + w.substr(1).toLowerCase())
            .join(' '))
        .join(', ');
}

function trimTrailingDecimals(numberString) {
    return numberString.replace(/\.\d+$/, '');
}
// cloud-/data/properties.json
//Local=http://localhost:3000/properties.json
async function fetchData() {
    const data = fetch('/data/properties.json')
        .then(req => req.json())
        .then(places => places.map((p, i) => {
            let id = p['MINE_ID'];
            if (id == 'N/A') {
                id = p['MINE_ID'];
            }
            if (id == 'N/A') {
                id = p['OLD ID'];
            }

            return {
                id: id,
                lat: 45 + i / 10,
                lng: -70 + i / 10,
                ...p,
                // Some property types have extra whitespace around the text...
                'PROPERTY_TYPE': p['MINE_TYPE'].trim(),
                'MINE_AREA_ACRES': trimTrailingDecimals(p['MINE_AREA_ACRES'])
            }
        }))
        .catch(e => {
            alert(`Error fetching data: ${e}`);
        });
    const places = await data;
    console.log(places);
    // Sidebar should list properties by plot size, desc
    const area = place => parseFloat(place['MINE_AREA_ACRES'].replace(',', ''));
    return places.sort((a, b) => {
        if (area(a) < area(b)) return 1;
        if (area(a) > area(b)) return -1;
        return 0;
    });
}

const COMPLIANCE = {
    C: 'Compliant',
    V: 'Violations',
}

class Property extends Record {
    constructor(id, attrs) {
        super(id, {
            ...attrs,
            _hidden: false,
        });
    }
    getArea() {
        return parseFloat(this.get('MINE_AREA_ACRES').replace(',', ''));
    }
    formattedPlotArea() {
        const plotArea = this.get('MINE_AREA_ACRES');
        if (plotArea == 'N/A') {
            return plotArea;
        } else {
            return plotArea + ' Acres';
        }
    }
    formattedBuiltUpArea() {
        const plotArea = this.get('TOTAL_EXCAVATED_AREA');
        if (plotArea == 'N/A') {
            return plotArea;
        } else {
            return plotArea + 'Acres';
        }
    }
    getCenter() {
        if (!this.get('GEOJSON')) {
            throw new Error('Property.getCenter cannot be access before geometry is loaded!');
        }

        const center = turf.centerOfMass(this.get('GEOJSON'));
        const [lng, lat] = center.geometry.coordinates;

        return new google.maps.LatLng(lat, lng);
    }
    imageURL() {
        return `https://airserve-m-360.web.app/images/reports/${this.get('ID')}.JPG`;
    }
}

class SearchComplete extends Component {
    init({
        updateInput,
    }) {
        this.MAX_SUGGESTIONS = 8;

        this.updateInput = updateInput;

        this.value = '';
        this._focused = false;
        this._suggestionIdx = -1;
        this._suggestionValue = null;
        this.completions = [];

        this.oninput = evt => {
            this.value = evt.target.value;
            this._suggestionIdx = -1;
            this.render();
        };
        this.onkeydown = evt => {
            switch (evt.key) {
                case 'ArrowUp':
                    evt.preventDefault();
                    this._suggestionIdx--;
                    break;
                case 'ArrowDown':
                    evt.preventDefault();
                    this._suggestionIdx++;
                    break;
                case 'Enter':
                    if (this._suggestionIdx >= 0) {
                        this.value = this._suggestionValue;
                    }
                    this.updateInput(this.value);
                    break;
            }
            if (this._suggestionIdx >= this.MAX_SUGGESTIONS) {
                this._suggestionIdx--;
            }
            if (this._suggestionIdx < -1) {
                this._suggestionIdx = -1;
            }
            this.render();
        }
        this.onfocus = () => {
            setTimeout(() => {
                this._focused = true;
                this._suggestionIdx = -1;
                this.render();
            }, 100);
        }
        this.onblur = () => {
            setTimeout(() => {
                this._focused = false;
                this.render();
            }, 100);
        }
    }
    updateAutocompleteList(completions) {
        this.completions = completions;
    }
    compose() {
            function Suggestion(term, idx) {
                if (idx == this._suggestionIdx) {
                    this._suggestionValue = term;
                }
                const matchIdx = term.toLowerCase().indexOf(this.value.toLowerCase());
                return html `<div class="SearchComplete-suggestion ${idx == this._suggestionIdx ? 'selected' : ''}"
                onclick=${() => {
                    this.value = term;
                    this.updateInput(this.value);
                    this.render();
                }}>
                ${term.substr(0, matchIdx)}<strong>${term.substr(matchIdx, this.value.length)}</strong>${term.substr(matchIdx + this.value.length)}
            </div>`;
            }

            return html `<div class="FilterBar-search">
            <div class="SearchComplete">
                <input type="text"
                    class="FilterBar-search-input outlined padded"
                    value=${this.value}
                    oninput=${this.oninput}
                    onkeydown=${this.onkeydown}
                    placeholder="Search..."
                    onfocus=${this.onfocus}
                    onblur=${this.onblur}/>
                ${this._focused ? html`
                    <div class="SearchComplete-completions wrap">
                        ${this.completions
                    .filter(id => id.toLowerCase().includes(this.value.toLowerCase()))
                    .slice(0, this.MAX_SUGGESTIONS)
                    .map(Suggestion.bind(this))}
                    </div>
                ` : null}
            </div>
            <button class="FilterBar-search-button filled"
                onclick=${() => this.updateInput(this.value)}>
                <img src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjZmZmZmZmIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMzIgMzIiIGVuYWJsZS1iYWNrZ3JvdW5kPSJuZXcgMCAwIDMyIDMyIiB4bWw6c3BhY2U9InByZXNlcnZlIj48ZyBkaXNwbGF5PSJub25lIj48ZyBkaXNwbGF5PSJpbmxpbmUiPjxlbGxpcHNlIGZpbGw9IiNmZmZmZmYiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBjeD0iMTQuOTk3IiBjeT0iMTMuMTk2IiByeD0iMTMuMDgiIHJ5PSIxMi42OTYiPjwvZWxsaXBzZT48bGluZSBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgeDE9IjIyLjU5OCIgeTE9IjIzLjI5MyIgeDI9IjMwLjIxNCIgeTI9IjMxLjY2NCI+PC9saW5lPjwvZz48L2c+PGcgZGlzcGxheT0ibm9uZSI+PGcgZGlzcGxheT0iaW5saW5lIj48Zz48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNMTQuOTk3LDI2LjM5MmMtNy40ODgsMC0xMy41ODEtNS45Mi0xMy41ODEtMTMuMTk2UzcuNTA5LDAsMTQuOTk3LDBzMTMuNTgsNS45MTksMTMuNTgsMTMuMTk1ICAgICBTMjIuNDg1LDI2LjM5MiwxNC45OTcsMjYuMzkyeiBNMTQuOTk3LDFDOC4wNiwxLDIuNDE2LDYuNDcxLDIuNDE2LDEzLjE5NVM4LjA2LDI1LjM5MiwxNC45OTcsMjUuMzkyICAgICBjNi45MzcsMCwxMi41OC01LjQ3MiwxMi41OC0xMi4xOTZTMjEuOTM0LDEsMTQuOTk3LDF6Ij48L3BhdGg+PC9nPjxnPjxyZWN0IHg9IjI1LjkwNSIgeT0iMjEuODIiIHRyYW5zZm9ybT0ibWF0cml4KDAuNzM5NiAtMC42NzMgMC42NzMgMC43Mzk2IC0xMS42MTc4IDI0LjkyNTgpIiBmaWxsPSIjZmZmZmZmIiB3aWR0aD0iMS4wMDEiIGhlaWdodD0iMTEuMzE3Ij48L3JlY3Q+PC9nPjwvZz48L2c+PGcgZGlzcGxheT0ibm9uZSI+PGcgZGlzcGxheT0iaW5saW5lIj48Zz48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNMTQuOTk3LDI2LjM5MmMtNy40ODgsMC0xMy41ODEtNS45Mi0xMy41ODEtMTMuMTk2UzcuNTA5LDAsMTQuOTk3LDBzMTMuNTgsNS45MTksMTMuNTgsMTMuMTk1ICAgICBTMjIuNDg1LDI2LjM5MiwxNC45OTcsMjYuMzkyeiBNMTQuOTk3LDFDOC4wNiwxLDIuNDE2LDYuNDcxLDIuNDE2LDEzLjE5NVM4LjA2LDI1LjM5MiwxNC45OTcsMjUuMzkyICAgICBjNi45MzcsMCwxMi41OC01LjQ3MiwxMi41OC0xMi4xOTZTMjEuOTM0LDEsMTQuOTk3LDF6Ij48L3BhdGg+PC9nPjxnPjxyZWN0IHg9IjI1LjkwNSIgeT0iMjEuODIiIHRyYW5zZm9ybT0ibWF0cml4KDAuNzM5NiAtMC42NzMgMC42NzMgMC43Mzk2IC0xMS42MTc4IDI0LjkyNTgpIiBmaWxsPSIjZmZmZmZmIiB3aWR0aD0iMS4wMDEiIGhlaWdodD0iMTEuMzE3Ij48L3JlY3Q+PC9nPjwvZz48L2c+PGc+PHBhdGggZD0iTTI3LjM2OCwxMi42M2MwLTYuOTYxLTUuODEzLTEyLjYwNC0xMi45ODMtMTIuNjA0Yy03LjE3MSwwLTEyLjk4Myw1LjY0My0xMi45ODMsMTIuNjA0czUuODEzLDEyLjYwNCwxMi45ODMsMTIuNjA0ICAgYzIuNDcxLDAsNC43NzMtMC42ODMsNi43NC0xLjg0NmwtMC4zMDQsMC4yNzdsNy41Niw4LjMxbDIuMjE5LTIuMDJsLTcuMzc3LTguMTA5QzI1Ljc2NywxOS41NDUsMjcuMzY4LDE2LjI3MywyNy4zNjgsMTIuNjN6ICAgIE00LjQwMSwxMi42M2MwLTUuMjk2LDQuNDc5LTkuNjA0LDkuOTgzLTkuNjA0YzUuNTA1LDAsOS45ODMsNC4zMDksOS45ODMsOS42MDRzLTQuNDc5LDkuNjA0LTkuOTgzLDkuNjA0ICAgQzguODgsMjIuMjM0LDQuNDAxLDE3LjkyNiw0LjQwMSwxMi42M3oiPjwvcGF0aD48L2c+PC9zdmc+" alt="Search" />
            </button>
        </div>`;
    }
}

class GeoFilter extends Component {
    init(getFilters, updateFilters) {
        this.selections = [];
        this.getFilters = getFilters;
        this.updateFilters = updateFilters;
    }
    displayText() {
        return this.getFilters().geo ? this.getFilters().geo.name : 'Geography';
    }
    updateFilterFromSelections() {
        if (!this.selections.length) {
            this.updateFilters({ geo: null });
            this.render();
            return;
        }

        this.updateFilters({
            geo: this.selections[this.selections.length - 1],
        })
        this.render();
    }
    findMatchingGeo(geoRoot, name) {
        return geoRoot.filter(geo => geo.name == name)[0];
    }
    compose() {
        function lexicographically(a, b) {
            if (a.name < b.name) {
                return -1;
            } else if (b.name < a.name) {
                return 1;
            }
            return 0;
        }

        // if filter was set elsewhere, sync this.selections to this.getFilters().geo
        const { geo } = this.getFilters();
        if (geo) {
            this.selections = geo.parents.concat(geo);
        }

        return html`<div class="GeoFilter FilterPopup">
            <div class="FilterPopup-body">
                <div class="GeoFilter-geos">
                    <label>
                        <p>District</p>
                        <select class="padded outlined"
                            onchange=${evt => {
                this.selections = [this.findMatchingGeo(GEOS, evt.target.value)].filter(g => !!g);
                this.updateFilterFromSelections();
            }}>
                            <option value="">--Select --</option>
                            ${GEOS.sort(lexicographically).map(({ name }) => {
                return html`<option value=${name}
                                    selected=${this.selections[0] && this.selections[0].name == name}>${name}</option>`;
            })}
                        </select>
                    </label>
                    ${this.selections[0] && this.selections[0].contains.length ? html`<label>
                        <p>Mandal/City/Municipality</p>
                        <select class="padded outlined"
                            onchange=${evt => {
                    this.selections = [
                        this.selections[0],
                        this.findMatchingGeo(this.selections[0].contains, evt.target.value),
                    ].filter(g => !!g);
                    this.updateFilterFromSelections();
                }}>
                            <option value="">--Select --</option>
                            ${this.selections[0].contains.sort(lexicographically).map(({ name }) => {
                    return html`<option value=${name}
                                    selected=${this.selections[1] && this.selections[1].name == name}>${name}</option>`;
                })}
                        </select>
                    </label>` : null}
                    ${this.selections[1] && this.selections[1].contains.length ? html`<label>
                        <p>Village/Zone</p>
                        <select class="padded outlined"
                            onchange=${evt => {
                    this.selections = [
                        this.selections[0],
                        this.selections[1],
                        this.findMatchingGeo(this.selections[1].contains, evt.target.value),
                    ].filter(g => !!g);
                    this.updateFilterFromSelections();
                }}>
                            <option value="">--Select --</option>
                            ${this.selections[1].contains.sort(lexicographically).map(({ name }) => {
                    return html`<option value=${name}
                                    selected=${this.selections[2] && this.selections[2].name == name}>${name}</option>`;
                })}
                        </select>
                    </label>` : null}
                </div>
            </div>
            <div class="buttonGroup">
                <button class="filterPopupButton outlined padded"
                    onclick=${() => {
                this.selections = [];
                this.updateFilterFromSelections();
            }}>Reset</button>
            </div>
        </div>`
    }
}

class PropertyTypeFilter extends Component {
    init(getFilters, updateFilters) {
        this.getFilters = getFilters;
        this.updateFilters = filters => {
            updateFilters(filters);
            this.render();
        };
    }
    displayText() {
        const propType = this.getFilters().propertyType;
        return propType ? propType[0].toUpperCase() + propType.substr(1) : 'Type';
    }
    compose() {
        const { propertyTypes } = this.getFilters();
        return html`<div class="PropertyTypeFilter FilterPopup">
            <div class="FilterPopup-body">
                <p><b>Property type</b></p>
                ${PROPERTY_TYPES.map(propType => {
            const { name, color, textColor } = propType;
            return html`<label class="PropertyTypeFilter-label">
                        <input type="checkbox" name="PropertyTypeFilter" value=${name}
                            checked=${propertyTypes.includes(propType)}
                            onchange=${() => {
                    if (propertyTypes.includes(propType)) {
                        this.updateFilters({
                            propertyTypes: removeFromArray(propertyTypes, propType),
                        });
                    } else {
                        this.updateFilters({
                            propertyTypes: propertyTypes.concat(propType),
                        });
                    }
                }} />

                        <div class="propertyTypeLabel"
                            style="background:${color}; color:white">
                            ${name}
                        </div>
                    </label>`
        })}
            </div>
            <div class="buttonGroup">
                <button class="filterPopupButton outlined padded"
                    disabled=${propertyTypes.length == PROPERTY_TYPES.length}
                    onclick=${() => this.updateFilters({ propertyTypes: PROPERTY_TYPES.slice() })}>Check all</button>
                <button class="filterPopupButton outlined padded"
                    disabled=${propertyTypes.length == 0}
                    onclick=${() => this.updateFilters({ propertyTypes: [] })}>Uncheck all</button>
            </div>
        </div>`;
    }
}

class PlotAreaFilter extends Component {
    init(getFilters, updateFilters) {
        this.getFilters = getFilters;
        this.updateFilters = updateFilters;
    }
    displayText() {
        const { areaMin, areaMax } = this.getFilters();
        if (areaMin && areaMax) {
            return `${areaMin}Acres-${areaMax}Acres`;
        }
        if (areaMin) {
            return `> ${areaMin} Acres`;
        }
        if (areaMax) {
            return `< ${areaMax} Acres`;
        }
        return 'Area';
    }
    compose() {
        const { areaMin, areaMax } = this.getFilters();
        return html`<div class="PlotAreaFilter FilterPopup FilterPopup-body">
            <p class="PlotAreaFilter-label">Area range  (Acres)</p>
            <div class="inputWrapper">
                <input type="number" value=${areaMin}
                    class="outlined padded"
                    placeholder="min"
                    oninput=${evt => this.updateFilters({ areaMin: +evt.target.value || null })}/>
                -
                <input type="number" value=${areaMax}
                    class="outlined padded"
                    placeholder="max"
                    oninput=${evt => this.updateFilters({ areaMax: +evt.target.value || null })}/>
            </div>
        </div>`;
    }
}

class FilterBar extends Component {
    init(places, { getFilters, updateFilters }) {
        this.search = new SearchComplete({
            updateInput: (term) => {
                updateFilters({ search: term });

                // If the search term is a geographic region, select the geo region.
                if (!term) {
                    return;
                }
                for (const geo of ALL_GEOS) {
                    if (geo.name.toLowerCase() == term.toLowerCase()) {
                        updateFilters({ geo });
                        this.render();
                        break;
                    }
                }
            },
        });

        this.getFilters = getFilters;
        this.updateFilters = updateFilters;

        this.places = places;
        this.bind(places, () => this.updateAutocompleteList());

        const udf = filters => this.updateFilters(filters);

        this.showGeo = null;
        this.geoFilter = new GeoFilter(this.getFilters, udf);
        this.showPlotArea = null;
        this.plotAreaFilter = new PlotAreaFilter(this.getFilters, udf);
        this.showPropertyType = null;
        this.propertyTypeFilter = new PropertyTypeFilter(this.getFilters, udf);

        document.body.addEventListener('click', evt => {
            if (evt.target.classList.contains('FilterBar-slot-opener')) {
                return;
            }

            // for each open filter, if not inside node, close filter
            if (!this.geoFilter.node.contains(evt.target)) {
                this.showGeo = null;
            }
            if (!this.plotAreaFilter.node.contains(evt.target)) {
                this.showPlotArea = null;
            }
            if (!this.propertyTypeFilter.node.contains(evt.target)) {
                this.showPropertyType = null;
            }
            this.render();
        });
    }
    updateAutocompleteList() {
        const currentGeo = this.getFilters().geo || { contains: GEOS };
        const childGeos = getChildGeoNames(currentGeo);
        const places = this.places.summarize()
            .map(p => p.summarize())
            .filter(props => !props['_hidden']);
        const suggestions = places.map(p => p['MINE_ID'])
            .concat(places.map(p => p['LESSEE_NAME']))
            .concat(childGeos)
            .filter(s => !!s);
        this.search.updateAutocompleteList([...new Set(suggestions)]);
    }
    closeAllFilters() {
        this.showGeo = this.showPlotArea = this.showPropertyType = null;
    }
    compose() {
        const {
            geo,
            violations,
            propertyTypes,
            areaMin,
            areaMax,
        } = this.getFilters();
        const isHidingCompliances = violations == 'V';

        return html`<div class="FilterBar">
            <div class="FilterBar-slot">
                ${this.search.node}
            </div>

            <div class="FilterBar-proptype FilterBar-slot">
                <div class="FilterBar-slot-opener ${geo ? 'filled' : 'outlined'} padded" onclick=${evt => {
                this.closeAllFilters();
                this.showGeo = this.showGeo ? null : true;
                this.render();
            }}>${this.geoFilter.displayText()}</div>
                ${this.showGeo && this.geoFilter.node}
            </div>

            <div class="FilterBar-proptype FilterBar-slot">
                <div class="FilterBar-slot-opener ${propertyTypes.length === PROPERTY_TYPES.length ? 'filled' : 'outlined'} padded" onclick=${evt => {
                this.closeAllFilters();
                this.showPropertyType = this.showPropertyType ? null : true;
                this.render();
            }}>${this.propertyTypeFilter.displayText()}</div>
                ${this.showPropertyType && this.propertyTypeFilter.node}
            </div>

            <div class="FilterBar-proptype FilterBar-slot">
                <div class="FilterBar-slot-opener ${(areaMin || areaMax) ? 'filled' : 'outlined'} padded" onclick=${evt => {
                this.closeAllFilters();
                this.showPlotArea = this.showPlotArea ? null : true;
                this.render();
            }}>${this.plotAreaFilter.displayText()}</div>
                ${this.showPlotArea && this.plotAreaFilter.node}
            </div>

            <div class="FilterBar-gap"></div>

            <div class="FilterBar-proptype FilterBar-slot">
                <label class="FilterBar-resetButton outlined padded"
                    onclick=${() => {
                this.updateFilters({
                    search: '',
                    geo: null,
                    propertyTypes: PROPERTY_TYPES.slice(),
                    areaMin: null,
                    areaMax: null,
                });
                this.render();
            }}>
                    Reset
                </label>
            </div>
        </div>`;
    }
    render(...args) {
        this.search.value = this.getFilters().search;
        this.search.render();

        this.geoFilter.render();
        this.propertyTypeFilter.render();
        this.plotAreaFilter.render();

        return super.render(...args);
    }
}

class PropertyOverlayPopup extends Component {
    init(place) {
        this.place = place;
    }
    compose() {
        const props = this.place.summarize();
        return html`<div class="PropertyOverlayPopup">
            <div class="left">
                <img src="${this.place.imageURL()}"
                    onerror=${evt => evt.target.src = '/img/fallback.png'} />
            </div>
            <div class="right" >
                <b>${props['LESSEE_NAME'] || 'N/A'}</b>
                <p><b>Mine Area</b>: ${this.place.formattedPlotArea()}</p>
                <p><b>Mineral Type</b>: ${props['PROPERTY_TYPE']}</p>
            </div>
        </div>`;
    }
}

class PropertyOverlayView extends google.maps.OverlayView {
    constructor(place, { updateFilters }) {
        super();

        this.place = place;
        this.center = place.getCenter();
        this.updateFilters = updateFilters;

        this._popup = new PropertyOverlayPopup(this.place);
    }

    onAdd() {
        this.node = Torus.render(null, null, html`<div class="PropertyOverlayView"
            onclick=${() => this.updateFilters({
            search: this.place.id,
        })}
            onmouseenter=${this.showPopup.bind(this)}
            onmouseleave=${this.hidePopup.bind(this)}  >
            <div class="PropertyOverlayView-inspection"
                style="background:${getIndicatorColor(this.place)}" />
        </div>`);
        const panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(this.node);
    }

    showPopup() {
        if (this.node) {
            // must be above other overlay markers 
            this.getPanes().overlayMouseTarget.appendChild(this.node);
            this.node.appendChild(this._popup.node);
            this.node.classList.add('show-popup');
        }
    }
    hidePopup() {
        if (!this.node) return;

        if (this._popup.node.parentNode == this.node) {
            this.node.removeChild(this._popup.node);
        }
        this.node.classList.remove('show-popup');
    }
    draw() {
        // modified from https://developers.google.com/maps/documentation/javascript/customoverlays

        // We use the south-west and north-east
        // coordinates of the overlay to peg it to the correct position and size.
        // To do this, we need to retrieve the projection from the overlay.
        const overlayProjection = this.getProjection();

        // Retrieve the south-west and north-east coordinates of this overlay
        // in LatLngs and convert them to pixel coordinates.
        // We'll use these coordinates to resize the div.
        const center = overlayProjection.fromLatLngToDivPixel(this.center);

        // Resize the image's div to fit the indicated dimensions.
        if (this.node) {
            this.node.style.transform = `translate(calc(${center.x}px - 50%), calc(${center.y}px - 50%))`;
            // only markers visible in viewport should be in DOM, for performance
            const halfWidth = window.innerWidth / 2;
            const halfHeight = window.innerHeight / 2;
            if (center.x < -halfWidth || center.x > halfWidth || center.y < -halfHeight || center.y > halfHeight) {
                if (this.node.parentNode) {
                    this.node.parentNode.removeChild(this.node);
                }
            } else {
                if (!this.node.parentNode) {
                    this.getPanes().overlayMouseTarget.appendChild(this.node);
                }
            }
        }
    }
    onRemove() {
        if (this.node && this.node.parentNode) {
            this.node.parentNode.removeChild(this.node);
            this.node = null;
        }
    }
}

class GeoOverlayView extends google.maps.OverlayView {
    constructor(geo, name, propertyCount) {
        super();

        this.geo = geo;
        this.name = name;
        this.propertyCount = propertyCount;
        this.center = (() => {
            const center = turf.centerOfMass(geo);
            const [lng, lat] = center.geometry.coordinates;
            return new google.maps.LatLng({ lat, lng });
        })();
    }
    onAdd() {
        this.node = Torus.render(null, null, html`<div class="GeoOverlayView">
            <div class="GeoOverlayView-name">${this.name}</div>
            <div class="GeoOverlayView-propertyCount">${this.propertyCount} properties</div>
        </div>`);
        const panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(this.node);
    }
    draw() {
        // modified from https://developers.google.com/maps/documentation/javascript/customoverlays

        // We use the south-west and north-east
        // coordinates of the overlay to peg it to the correct position and size.
        // To do this, we need to retrieve the projection from the overlay.
        const overlayProjection = this.getProjection();

        // Retrieve the south-west and north-east coordinates of this overlay
        // in LatLngs and convert them to pixel coordinates.
        // We'll use these coordinates to resize the div.
        const center = overlayProjection.fromLatLngToDivPixel(this.center);

        // Resize the image's div to fit the indicated dimensions.
        if (this.node) {
            this.node.style.transform = `translate(calc(${center.x}px - 50%), calc(${center.y}px - 50%))`;
            // only markers visible in viewport should be in DOM, for performance
            const halfWidth = window.innerWidth / 2;
            const halfHeight = window.innerHeight / 2;
            if (center.x < -halfWidth || center.x > halfWidth || center.y < -halfHeight || center.y > halfHeight) {
                if (this.node.parentNode) {
                    this.node.parentNode.removeChild(this.node);
                }
            } else {
                if (!this.node.parentNode) {
                    this.getPanes().overlayMouseTarget.appendChild(this.node);
                }
            }
        }
    }
    onRemove() {
        if (this.node && this.node.parentNode) {
            this.node.parentNode.removeChild(this.node);
            this.node = null;
        }
    }
}

class PropertyLayer extends Component {
    init(place, _remover, map, { updateFilters }) {
        this.place = place;
        this.map = map;

        this.layer = [];
        this.label = null;

        this._visible = false;
        this._plotlineVisible = false;
        // if the property has no geometry, doesn't make sense to show marker
        // on the map
        if (this.place.get('GEOJSON_Shape')) {
            this.label = new PropertyOverlayView(this.place, { updateFilters });
        }

        this.bind(place, data => this.render(data));
    }
    centerOnMap() {
        const geojson = this.place.get('GEOJSON');
        if (!geojson) {
            return;
        }

        const bbox = turf.bbox(geojson);

        const bounds = new google.maps.LatLngBounds();
        const [lngNW, latNW, lngSE, latSE] = bbox;
        bounds.extend(new google.maps.LatLng({
            lat: latNW,
            lng: lngNW,
        }));
        bounds.extend(new google.maps.LatLng({
            lat: latSE,
            lng: lngSE,
        }));

        this.map.fitBounds(bounds);
    }
    toggleExcavatedPlotlines(visible) {
        this._plotlineVisible = visible;
        this.render();
    }
    render() {
        const props = this.record.summarize();
        if (!props.GEOJSON) return [];

        const isVisible = !props._hidden && this._plotlineVisible;
        const isMarkerVisible = !props._hidden;

        if (isVisible) {
            if (!this._visible) {
                this._visible = true;
                if (props.GEOJSON) {
                    this.layer = this.map.data.addGeoJson(this.place.get('GEOJSON'));
                }
            }
            const featureColor = getIndicatorColor(this.place);
            for (const feature of this.layer) {
                feature.setProperty('highlighted', props._popup);
                feature.setProperty('color', featureColor);
            }
        } else {
            if (this._visible) {
                this._visible = false;
                for (const feature of this.layer) {
                    this.map.data.remove(feature);
                }
            }
        }

        if (isMarkerVisible) {
            this.label.setMap(this.map);
        } else {
            this.label.setMap(null);
        }

        if (props._center) {
            this.centerOnMap();
        }

        if (props._popup) {
            this.label.showPopup();
        } else {
            this.label.hidePopup();
        }
        return null;
    }


}

class LayerGroup extends ListOf(PropertyLayer) {

    toggleExcavatedPlotlines(visible) {
        this.components.forEach(c => c.toggleExcavatedPlotlines(visible));

    }
    render() {
        this.components.forEach(c => c.record.emitEvent());
        return null;
    }
}

class GoogleMap extends Component {
    init(places, { getFilters, updateFilters }) {
        this.places = places;
        this.showExcavatedPlotlines = false;

        this.showBoundaries = true;
        this._geos = [];
        this._geoFeatures = [];
        this._geoLabels = [];

        this.getFilters = getFilters;
        this.updateFilters = updateFilters;

        this.mapContainer = document.createElement('div');
        this.mapContainer.classList.add('map-div');

        this.map = new google.maps.Map(this.mapContainer, {
            center: {
                lat: 18.39,
                lng: 78.582,
            },
            zoom: 11,

        });
        this.map.setMapTypeId(google.maps.MapTypeId.HYBRID);
        this.map.addListener('zoom_changed', this.render.bind(this));

        this.layers = new LayerGroup(this.places, this.map, { updateFilters });
        setTimeout(() => this.recenter(), 1000);

        // map boundary coloring
        const setStyle = feature => {
            if (feature) {
                if (feature.getProperty('isBoundary')) {
                    return BOUNDARY_STYLES.geo;
                }
                if (feature.getProperty('highlighted')) {
                    return BOUNDARY_STYLES.highlighted;
                }
                if (feature.getProperty('color')) {
                    const featureColor = feature.getProperty('color');
                    return {
                        fillColor: featureColor,
                        strokeColor: featureColor,
                        strokeWeight: 1,
                    }
                }
            }
            return getBoundaryStyles(this.map.getMapTypeId());
        }
        this.map.data.setStyle(setStyle);
        this.map.addListener('maptypeid_changed', () => {
            this.map.data.setStyle(setStyle);
            this.render();
        });
        this.map.data.addListener('mouseover', ({ feature }) => {
            feature.setProperty('highlighted', true);
        });
        this.map.data.addListener('mouseout', ({ feature }) => {
            feature.setProperty('highlighted', false);
        });
        this.map.data.addListener('click', ({ feature }) => {
            if (feature.getProperty('isBoundary')) {
                this.setGeoFilterFromFeature(feature);
            }
        });

        this.toggleBoundaries = () => {
            this.showBoundaries = !this.showBoundaries;
            this.renderBoundaries();
            this.render();
        }
        this.toggleExcavatedPlotlines = () => {
            this.showExcavatedPlotlines = !this.showExcavatedPlotlines;
            this.layers.toggleExcavatedPlotlines(this.showExcavatedPlotlines);
            this.render();
        }
        this.showPlotlines = false;
        this.plotlayer = [];
        this.togglePlotlines = () => {
            this.showPlotlines = !this.showPlotlines;
            this.render();
            let property = this.places.summarize()
            property.forEach(place => {

                const props = place.summarize();
                if (!props.GEOJSON) return [];

                const isVisible = !props._hidden && this.showPlotlines;

                if (isVisible) {
                    if (props.GEOJSON) {
                        this.plotlayer = this.map.data.addGeoJson(props['GEOJSON_Shape']);

                    }
                    this.plotlayer.forEach(fea => {
                        fea.setProperty('color', "rgb(255,235,175)")
                    })

                }
                else {
                    if (this.showPlotlines == false) {
                        this.map.data.forEach(feature => {
                            if (feature['j']['BHOOMI_ID']) {
                                this.map.data.remove(feature);
                            }

                        })
                    }

                }
            })

        }
    }

    filter(filterFn) {
        this.layers.filter(filterFn);
    }

    setGeoFilterFromFeature(feature) {
        const geographyID = feature.getProperty('geographyID');
        let selectedGeo = null;
        for (const geo of ALL_GEOS) {
            if (geo.id == geographyID) {
                selectedGeo = geo;
                break;
            }
        }
        this.updateFilters({
            geo: selectedGeo,
        });
    }

    setGeoBoundaries(geos) {
        this._geos = geos;
        this.renderBoundaries();
    }

    renderBoundaries() {
        for (const feature of this._geoFeatures) {
            this.map.data.remove(feature);
        }
        for (const label of this._geoLabels) {
            label.setMap(null);
        }

        const propertiesJSON = this.places.summarize().map(p => p.data).filter(p => !p._hidden);
        // The first geoJSON is always a top-level boundary, which is
        // never labelled.
        this._geoLabels = this._geos.slice(1).map(geo => {
            if (geo == TELANGANA) {
                const label = new GeoOverlayView(geo.geojson, geo.name, propertiesJSON.length);
                label.setMap(this.map);
                return label;
            }

            const propertyCount = propertiesJSON.filter(p => geo.ids.includes(p.GEOGRAPHY_ID)).length;
            const label = new GeoOverlayView(geo.geojson, geo.name, propertyCount);
            label.setMap(this.map);
            return label;
        });

        if (this.showBoundaries) {
            this._geoFeatures = [];
            for (const { id, geojson } of this._geos) {
                this._geoFeatures = this._geoFeatures.concat(this.map.data.addGeoJson(geojson));
                const features = this.map.data.addGeoJson(geojson);
                for (const feature of features) {
                    feature.setProperty('isBoundary', true);
                    feature.setProperty('geographyID', id);
                }
                this._geoFeatures = this._geoFeatures.concat(features);
            }
        }
    }

    recenter() {
        // When re-centering/zooming, we ignore the top level
        // geo (the first item in the list).
        let visibleGeoJSONs = this._geos.slice(1).map(g => g.geojson);
        if (!visibleGeoJSONs.length) {
            // If no geos we can zoom to (e.g. if we're zoomed in to
            // the lowest geo level like a Zone) show properties instead.
            visibleGeoJSONs = this.places.summarize().filter(p => {
                return !p.get('_hidden') && p.get('GEOJSON');
            }).map(p => p.get('GEOJSON'));
        }
        if (!visibleGeoJSONs.length) {
            // if still no geos, then just zoom to the top level
            // of the searched geographic hierarchy.

            // in some cases, the top-level geography that's been searched for
            // does not have a geography boundary defined in the database.
            // In those cases, we should just give up / abort recentering.
            if (this._geos.length == 0) {
                return;
            }

            visibleGeoJSONs = [this._geos[0].geojson];
        }

        if (!visibleGeoJSONs.length) {
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        for (const geojson of visibleGeoJSONs) {
            const bbox = turf.bbox(geojson);
            const [lngNW, latNW, lngSE, latSE] = bbox;
            bounds.extend(new google.maps.LatLng({
                lat: latNW,
                lng: lngNW,
            }));
            bounds.extend(new google.maps.LatLng({
                lat: latSE,
                lng: lngSE,
            }));
        }

        this.map.fitBounds(bounds);
    }

    compose() {
        const { geo, violations } = this.getFilters();
        return html`<div class="GoogleMap
            Zoom-${this.map.getZoom()}
            Geo-${geo ? geo.level : ''}
            MapTypeId-${this.map.getMapTypeId()}">
            <div class="mapButtonGroup">
                <button class="outlined padded"
                    onclick=${this.toggleBoundaries}>
                    ${this.showBoundaries ? 'Hide' : 'Show'} Boundaries
                </button>
                <button class="outlined padded"
                onclick=${this.togglePlotlines}>
                ${this.showPlotlines ? 'Hide' : 'Show'} Plot Lines
            </button>
                <button class="outlined padded"
                    onclick=${this.toggleExcavatedPlotlines}>
                    ${this.showExcavatedPlotlines ? 'Hide' : 'Show'} Excavated Area
                </button>
              
               
            </div>
            ${this.mapContainer}
        </div>`;
    }
}

class ReportLightbox extends Component {
    init(place, remover, reportName, url) {
        this.remover = remover;
        this.name = reportName || 'Property Report';
        this.url = url;
        this.captureClick = evt => evt.stopPropagation();

        this._errored = false;

        this.bind(place, data => this.render(data));
    }
    compose(props) {
        return html`<div class="ReportLightbox-wrapper"
            onclick=${this.remover}>
            <div class="ReportLightbox" onclick=${this.captureClick}>
                <div class="ReportLightbox-header">
                    <span class="reportTitle">${this.name}</span>
                    <button class="reportCloser" onclick=${this.remover}>Close</button>
                </div>
                <section class="ReportLightbox-propertyDetails">
                    ${!this._errored ? html`<img class="ReportLightbox-image" src="${this.url}" onerror=${() => {
                this._errored = true;
                this.render();
            }}/>` : html`<p class="noReportAvailable">No report available</p>`}
                </section>
            </div>
        </div>`
    }
}

class PlaceListingCard extends Component {
    init(place, _remover) {
        this.hovering = false;
        this.popup = null;
        this.hidePopup = this.hidePopup.bind(this);
        this.showInspectionReport = () => this.showPopup(
            'Inspection Report',
            'https://airserve-m-360.web.app/images/reports/TMINR.jpg'
            // `https://tbirdsalpha.web.app/images/inspectionreports/${place.get('MAKAAN_ID')}.jpg`
        );
        this.showRegistrationReport = () => this.showPopup(
            'Registration Report',
            'https://airserve-m-360.web.app/images/reports/TMINR.jpg'
            // `https://tbirdsalpha.web.app/images/registrationreports/${place.get('MAKAAN_ID')}.jpg`
        );
        this.showTaxReport = () => this.showPopup(
            'Tax Report',
            'https://airserve-m-360.web.app/images/reports/TMINR.jpg'
            // `https://tbirdsalpha.web.app/images/taxreports/${place.get('MAKAAN_ID')}.jpg`
        );
        this.showCesium = () => {
            this.showCesiumPopup(place)
        }
        this.centerOnMap = () => {
            this.record.update({ _center: true });
            setTimeout(() => this.record.update({ _center: false }), 100);
        }
        this.handleMouseenter = () => this.record.update({
            _popup: true,
        });
        this.handleMouseleave = () => this.record.update({
            _popup: false,
        });

        this.place = place;
        this.cachedCardContents = this.cardContents(place.summarize()).children;
        this.bind(place, this.render.bind(this));

    }

    // 3D view  window with masking the left side using Detail(div)
    showCesiumPopup(place) {
        let property = place.data;
        let cesium = document.createElement('div')
        let cesiumurl = property['Cesium_Id'] 
        let content =
            `<div class="CesiumLightbox-wrapper">
                        <div class="CesiumLightbox-header ReportLightbox-header">
                            <span class="Cesium-tile reportTitle">3D-View</span>
                            <button class="Cesiumcloser reportCloser" id="close">Close</button>
                       </div> 
                        <div class="CesiumPersonnel-3d">
                        <iframe id="Cesium-website" title="Untitled"  src=${cesiumurl} frameborder="0" allow="fullscreen" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>
                            </div> 
                        </div>`


        cesium.innerHTML = content;
        document.body.appendChild(cesium)
        document.getElementById("close").addEventListener('click', () => {
            document.body.removeChild(cesium)
        })
    }

    showPopup(reportName, reportURL) {
        if (this.popup) return;
        this.popup = new ReportLightbox(this.record, this.hidePopup, reportName, reportURL);
        document.body.appendChild(this.popup.node);
    }
    hidePopup() {
        if (!this.popup) return;
        document.body.removeChild(this.popup.node);
        this.popup = null;
    }

    cardContents(props) {
        const inspectionDetail = props['INSPECTION_INDICATOR'] ? html`<div class="PLC-detail" >
            <p >
                <b>${COMPLIANCE[props['INSPECTION_INDICATOR']]}:  </b>
                <span class="PLC-inspection"
                    style="background:${props['INSPECTION_INDICATOR'] == 'C' ? '#6cc648' : '#eb5065'}" />
            </p>
        </div>` : null;

        return html`<div>
            <div class="PLC-image" onclick=${this.centerOnMap}>
                <div class="PLC-top-left PLC-prop-id">
                    <strong>ID</strong>: ${props['MINE_ID']}
                </div>
                
                <img src="${this.place.imageURL()}"
                    onerror=${evt => {
                evt.target.src = '/img/fallback.png';
                evt.target.closest('.PLC-image').classList.add('broken');
            }}
                    loading="lazy" />
            </div>
            <div class="PLC-detail split">
            <p><b>Area:</b> ${this.place.formattedPlotArea()}</p>
            <p><b>Mineral: </b>  ${props['PROPERTY_TYPE']}</p>
            </div>
            <div class="PLC-detail">
                ${props['ESTIMATED_TOTAL_ROYALITY_PAID'] ? html`<p><b>Estimated Total Royality:  ₹</b>${props['ESTIMATED_TOTAL_ROYALITY_PAID']}</p>` : null}
            </div>
            <div class="PLC-detail">
                <p><b>Owned by</b></p>
                <p class="PLC-owner">${titleCase(props['LESSEE_NAME'] || 'N/A')}</p>
            </div>
            <div class="PLC-detail">
                <p><b>Located at</b></p>
                <p>${titleCase(props['ADDRESS'])}</p>
            </div>
            <div class="PLC-detail"> 
           
            ${inspectionDetail}   
            </div>
           
            <div class="PLC-detail PLC-report-detail">
            <p><b>Reports</b></p>
               <button class="PLC-button filled" onclick=${this.showCesium} style="height:50px;float:right;">3D View</button>
             
               
                <div class="PLC-reports">
                    <button class="PLC-button filled" onclick=${this.showInspectionReport}>
                        <img src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjZmZmZmZmIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMTAwIDEwMCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PGc+PHBhdGggZD0iTTY5LjA1NCw1OS4wNThsMjcuNDcxLDIzLjgxMWMyLjQ5NCwyLjE2MiwyLjc2Niw1Ljk3MSwwLjYwNCw4LjQ2NWwtMC45ODEsMS4xMzJjLTIuMTYyLDIuNDk0LTUuOTcxLDIuNzY2LTguNDY1LDAuNjA0ICAgTDYwLjQxOCw2OS40MzgiPjwvcGF0aD48L2c+PHBhdGggZD0iTTIuMzU4LDQxLjQ1OGMwLTE5Ljc0NCwxNi4wMDUtMzUuNzQ5LDM1Ljc1MS0zNS43NDljMTkuNzQ0LDAsMzUuNzQ5LDE2LjAwNSwzNS43NDksMzUuNzQ5ICBjMCwxOS43NDYtMTYuMDA1LDM1Ljc1MS0zNS43NDksMzUuNzUxQzE4LjM2Myw3Ny4yMDgsMi4zNTgsNjEuMjAzLDIuMzU4LDQxLjQ1OHogTTM4LjU2Myw2Ny41ODMgIGMxNC40MjgsMCwyNi4xMjQtMTEuNjk2LDI2LjEyNC0yNi4xMjZjMC0xNC40MjgtMTEuNjk2LTI2LjEyNC0yNi4xMjQtMjYuMTI0Yy0xNC40MywwLTI2LjEyNiwxMS42OTYtMjYuMTI2LDI2LjEyNCAgQzEyLjQzOCw1NS44ODcsMjQuMTM0LDY3LjU4MywzOC41NjMsNjcuNTgzeiI+PC9wYXRoPjwvc3ZnPg==" alt="Inspection" />
                        <div>Inspection</div>
                    </button>
                    <button class="PLC-button filled" onclick=${this.showTaxReport}>
                        <img src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjZmZmZmZmIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgNDggNDgiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDQ4IDQ4OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHBhdGggZD0iTTQ0LDEzaC04SDEySDRjLTAuNTUsMC0xLDAuNDUtMSwxdjh2NHY4YzAsMC41NSwwLjQ1LDEsMSwxaDhoMjRoOGMwLjU1LDAsMS0wLjQ1LDEtMXYtOHYtNHYtOEM0NSwxMy40NSw0NC41NSwxMyw0NCwxM3ogICBNNDMsMjUuMDZjLTQuMTcsMC40Ni03LjQ4LDMuNzgtNy45NCw3Ljk0SDI0SDEyLjk0Yy0wLjQ2LTQuMTctMy43OC03LjQ4LTcuOTQtNy45NHYtMi4xMWM0LjE3LTAuNDYsNy40OC0zLjc4LDcuOTQtNy45NEgyNGgxMS4wNiAgYzAuNDYsNC4xNywzLjc4LDcuNDgsNy45NCw3Ljk0VjI1LjA2eiI+PC9wYXRoPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjQiIHI9IjkiPjwvY2lyY2xlPjwvc3ZnPg==" alt="Tax" />
                        <div>Tax</div>
                    </button>
                </div>
                <div class="PLC-reports">
                      <button class="PLC-button filled" onclick=${this.showRegistrationReport}>
                        <img src="data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9JzMwMHB4JyB3aWR0aD0nMzAwcHgnICBmaWxsPSIjZmZmZmZmIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIiB2ZXJzaW9uPSIxLjEiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMCwtOTUyLjM2MjE4KSI+PHBhdGggc3R5bGU9ImZvbnQtc2l6ZTptZWRpdW07Zm9udC1zdHlsZTpub3JtYWw7Zm9udC12YXJpYW50Om5vcm1hbDtmb250LXdlaWdodDpub3JtYWw7Zm9udC1zdHJldGNoOm5vcm1hbDt0ZXh0LWluZGVudDowO3RleHQtYWxpZ246c3RhcnQ7dGV4dC1kZWNvcmF0aW9uOm5vbmU7bGluZS1oZWlnaHQ6bm9ybWFsO2xldHRlci1zcGFjaW5nOm5vcm1hbDt3b3JkLXNwYWNpbmc6bm9ybWFsO3RleHQtdHJhbnNmb3JtOm5vbmU7ZGlyZWN0aW9uOmx0cjtibG9jay1wcm9ncmVzc2lvbjp0Yjt3cml0aW5nLW1vZGU6bHItdGI7dGV4dC1hbmNob3I6c3RhcnQ7YmFzZWxpbmUtc2hpZnQ6YmFzZWxpbmU7b3BhY2l0eToxO2NvbG9yOiMwMDAwMDA7ZmlsbDojZmZmZmZmO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDo2O21hcmtlcjpub25lO3Zpc2liaWxpdHk6dmlzaWJsZTtkaXNwbGF5OmlubGluZTtvdmVyZmxvdzp2aXNpYmxlO2VuYWJsZS1iYWNrZ3JvdW5kOmFjY3VtdWxhdGU7Zm9udC1mYW1pbHk6U2FuczstaW5rc2NhcGUtZm9udC1zcGVjaWZpY2F0aW9uOlNhbnMiIGQ9Ik0gMTguNjg3NSA1IEEgMy4wMDAzIDMuMDAwMyAwIDAgMCAxNiA4IEwgMTYgOTIgQSAzLjAwMDMgMy4wMDAzIDAgMCAwIDE5IDk1IEwgODEgOTUgQSAzLjAwMDMgMy4wMDAzIDAgMCAwIDg0IDkyIEwgODQgMzQgQSAzLjAwMDMgMy4wMDAzIDAgMSAwIDc4IDM0IEwgNzggODkgTCAyMiA4OSBMIDIyIDExIEwgNjIgMTEgTCA2MiAyNCBBIDMuMDAwMyAzLjAwMDMgMCAwIDAgNjUgMjcgTCA4MSAyNyBBIDMuMDAwMyAzLjAwMDMgMCAwIDAgODMuMTI1IDIxLjg3NSBMIDY3LjEyNSA1Ljg3NSBBIDMuMDAwMyAzLjAwMDMgMCAwIDAgNjUgNSBMIDE5IDUgQSAzLjAwMDMgMy4wMDAzIDAgMCAwIDE4LjY4NzUgNSB6IE0gNjggMTUuMjE4NzUgTCA3My43ODEyNSAyMSBMIDY4IDIxIEwgNjggMTUuMjE4NzUgeiBNIDI3LjY4NzUgMjggQSAzLjAwNDA2NjMgMy4wMDQwNjYzIDAgMSAwIDI4IDM0IEwgNTAgMzQgQSAzLjAwMDMgMy4wMDAzIDAgMSAwIDUwIDI4IEwgMjggMjggQSAzLjAwMDMgMy4wMDAzIDAgMCAwIDI3LjY4NzUgMjggeiBNIDI3LjY4NzUgMzkgQSAzLjAwNDA2NjMgMy4wMDQwNjYzIDAgMSAwIDI4IDQ1IEwgNzIgNDUgQSAzLjAwMDMgMy4wMDAzIDAgMSAwIDcyIDM5IEwgMjggMzkgQSAzLjAwMDMgMy4wMDAzIDAgMCAwIDI3LjY4NzUgMzkgeiBNIDI3LjY4NzUgNTAgQSAzLjAwNDA2NjMgMy4wMDQwNjYzIDAgMSAwIDI4IDU2IEwgNzIgNTYgQSAzLjAwMDMgMy4wMDAzIDAgMSAwIDcyIDUwIEwgMjggNTAgQSAzLjAwMDMgMy4wMDAzIDAgMCAwIDI3LjY4NzUgNTAgeiBNIDI3LjY4NzUgNjEgQSAzLjAwNDA2NjMgMy4wMDQwNjYzIDAgMSAwIDI4IDY3IEwgNzIgNjcgQSAzLjAwMDMgMy4wMDAzIDAgMSAwIDcyIDYxIEwgMjggNjEgQSAzLjAwMDMgMy4wMDAzIDAgMCAwIDI3LjY4NzUgNjEgeiBNIDI3LjY4NzUgNzIgQSAzLjAwNDA2NjMgMy4wMDQwNjYzIDAgMSAwIDI4IDc4IEwgNzIgNzggQSAzLjAwMDMgMy4wMDAzIDAgMSAwIDcyIDcyIEwgMjggNzIgQSAzLjAwMDMgMy4wMDAzIDAgMCAwIDI3LjY4NzUgNzIgeiAiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAsOTUyLjM2MjE4KSI+PC9wYXRoPjwvZz48L3N2Zz4=" alt="Registration" />
                        <div>Agreement</div>
                    </button>
                     </div>
            </div>
        </div>`;
    }
    compose() {
        return html`<div class="PLC-wrapper ${this.place.get('GEOJSON') ? 'cursor-pointer' : ''}">
            <div class="PlaceListingCard"
                onmouseenter=${this.handleMouseenter}
                onmouseleave=${this.handleMouseleave}>
                ${this.cachedCardContents}
            </div>
        </div>`;
    }
}

class PlacesList extends ListOf(PlaceListingCard) {
    init(places, ...args) {
        super.init(places, ...args);

        // only show top 100
        this.MAX_ITEMS = 100;
        this.filter(p => p.get('_hidden') !== true);
    }
    // modified version from torus source
    itemsChanged() {
        //> For every record in the store, if it isn't already in
        //  `this.items`, add it and its view; if any were removed,
        //  also remove it from `this.items`.
        const data = this.store.summarize()
            .filter(record => this.filterFn(record))
            .slice(0, this.MAX_ITEMS);
        const items = this.items;
        for (const record of items.keys()) {
            if (!data.includes(record)) {
                items.get(record).remove();
                items.delete(record);
            }
        }
        for (const record of data) {
            if (!items.has(record)) {
                items.set(
                    record,
                    //> We pass a callback that takes a record and removes it from
                    //  the list's store. It's common in UIs for items to have a button
                    //  that removes the item from the list, so this callback is passed
                    //  to the item component constructor to facilitate that pattern.
                    new this.itemClass(
                        record,
                        () => this.store.remove(record),
                        ...this.itemData
                    )
                );
            }
        }

        let sorter = [...items.entries()];
        //> Sort the list the way the associated Store is sorted.
        sorter.sort((a, b) => data.indexOf(a[0]) - data.indexOf(b[0]));

        //> Store the new items in a new (insertion-ordered) Map at this.items
        this.items = new Map(sorter);

        this.render();
    }
    compose() {
        return html`<div class="PlacesList">
            <div class="sidebarHeader">
                ${this.store.summarize().filter(r => this.filterFn(r)).length}
                properties
            </div>
            <div class="placesListScrollbox">
                ${this.nodes}
            </div>
        </div>`
    }
}

class Sidebar extends Component {
    init(places) {
        this.list = new PlacesList(places);
    }
    filter(filterFn) {
        this.list.filter(filterFn);
    }
    compose() {
        return html`<div class="Sidebar">
            ${this.list.node}
        </div>`;
    }
}

class Dashboard extends Component {
    init(places) {
        this.filters = {
            search: '',
            geo: null,
            propertyTypes: PROPERTY_TYPES.slice(),
            areaMin: null,
            areaMax: null,
            violations: '',
        }
        this.places = places;

        this.filterBar = new FilterBar(places, {
            getFilters: () => this.filters,
            updateFilters: this.updateFilters.bind(this),
        });
        this.map = new GoogleMap(places, {
            getFilters: () => this.filters,
            updateFilters: this.updateFilters.bind(this),
        });
        this.sidebar = new Sidebar(places);
    }
    updateFilters(newFilters) {
        this.filters = {
            ...this.filters,
            ...newFilters,
        };

        const {
            search,
            geo,
            propertyTypes,
            areaMin,
            areaMax,
            violations,
        } = this.filters;

        // memoized for searching geos
        const matchingGeos = ALL_GEOS.filter(geo => geo.name.toLowerCase().includes(search.toLowerCase()));
        const matchingGeoIDs = matchingGeos.map(geo => geo.ids).flat();
        const propTypeNames = propertyTypes.map(pt => pt.name.toLowerCase());

        const filterFn = place => {
            const props = place.summarize();

            const lowerAddr = props['ADDRESS'].toLowerCase();
            if (geo && !geo.ids.includes(props['GEOGRAPHY_ID'])) {
                return false;
            }

            if (violations && props['INSPECTION_INDICATOR'] != violations) {
                return false;
            }

            if (propertyTypes.length !== PROPERTY_TYPES.length) {
                if (!propTypeNames.includes(props['PROPERTY_TYPE'].toLowerCase())) {
                    return false;
                }
            }

            if (areaMin != null) {
                if (place.getArea() < areaMin) {
                    return false;
                }
            }
            if (areaMax != null) {
                if (place.getArea() > areaMax) {
                    return false;
                }
            }

            if (search) {
                const searchString = props['MINE_ID'] + props['LESSEE_NAME'];
                if (search && searchString.toLowerCase().includes(search.toLowerCase())) {
                    return true;
                }

                if (matchingGeoIDs.includes(props['GEOGRAPHY_ID'])) {
                    return true;
                }

                return false;
            }

            return true;
        }

        const geoIDsContainingFilteredProperties = new Set();
        for (const place of this.places) {
            const visible = filterFn(place);
            place.update({
                _hidden: !visible,
            });
            if (visible) {
                geoIDsContainingFilteredProperties.add(place.get('GEOGRAPHY_ID'));
            }
        }
        this.places.emitEvent();

        // show all boundaries on map which contain at least one searched property
        const filteredGeos = getAllGeosContainingGeoID(geoIDsContainingFilteredProperties.values());

        const L0 = filteredGeos.filter(g => g.level == 0);
        const L1 = filteredGeos.filter(g => g.level == 1);
        const L2 = filteredGeos.filter(g => g.level == 2);

        if (L0.length == 1 && L1.length == 1 && L2.length == 1) {
            // top level zone
            this.map.setGeoBoundaries(L2.filter(x => !!x.geojson));
            if (L2[0] != this.filters.geo) {
                this.updateFilters({ geo: L2[0] });
            }
        } else if (L0.length == 1 && L1.length == 1) {
            // top level city
            this.map.setGeoBoundaries([...L1, ...L2].filter(x => !!x.geojson));
            if (L1[0] != this.filters.geo) {
                this.updateFilters({ geo: L1[0] });
            }
        } else if (L0.length == 1) {
            // top level district
            this.map.setGeoBoundaries([...L0, ...L1].filter(x => !!x.geojson));
        } else {
            // Telangana
            this.map.setGeoBoundaries([TELANGANA, ...L0].filter(x => !!x.geojson));
        }

        this.filterBar.updateAutocompleteList();

        this.map.recenter();
        this.filterBar.render();
    }
    compose() {
        return html`<div class="Dashboard">
            ${this.filterBar.node}
            <div class="Dashboard-map-area">
                ${this.map.node}
                ${this.sidebar.node}
            </div>
        </div>`;
    }
}


class App extends Component {
    init() {
        this.data = {};
        this.loadData();

        this.places = new Store();
        this.dashboard = new Dashboard(this.places);
    }
    async loadData() {
        const data = await fetchData();
        this.places.reset(data.map(p => new Property(p.id, p)));
        this.dashboard.updateFilters({});
    }
    compose() {
        return html`<div class="App">
            <header>
                <h1>
                    <div class="logoTop">
                        <img src="/img/airservelogo.png" alt="AirServe" />
                        
                    </div>
                    <div class="logoBottom">
                    Department of Mines and Geology Viewer
                    </div>
                </h1>
               
            </header>
            <div style="position: absolute;right: 10px;top:14px;"> <a href="/logout"><button id="logoutbtn">Logout</button></a></div>
            ${this.dashboard.node}
        </div>`
    }
}

let app;
function main() {
    app = new App();
    document.getElementById('root').appendChild(app.node);
}