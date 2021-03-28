// Geography database & utilities

let TELANGANA = null;
let GEOS = [];
let ALL_GEOS = [];

// ensure every geo object has Geo.ids list of all child areas' ID's
function addChildGeoIDs(root) {
    root.ids = root.contains.map(geo => addChildGeoIDs(geo)).flat().concat(root.id);
    return root.ids;
}

function addParentGeos(root, parents) {
    root.parents = parents;
    for (const child of root.contains) {
        addParentGeos(child, parents.concat(root));
    }
}

// build a flat list of all geos
function getAllGeos(root, list) {
    list.push(root);
    for (const child of root.contains) {
        getAllGeos(child, list);
    }
}

function getChildGeoNames(root) {
    return [root.name].concat(root.contains.map(g => getChildGeoNames(g)).flat());
}

// returns all geo objects that contain (directly or through child) any of a
// given list of geo ID's
function getAllGeosContainingGeoID(geoIDs) {
    let geos = new Set();
    for (const id of geoIDs) {
        for (const geo of ALL_GEOS) {
            if (geo.ids.includes(id)) {
                geos.add(geo);
            }
        }
    }
    return [...geos.values()];
}

// load geos, start app
// cloud-/data/geos.json
//Local--http://localhost:3000/geos.json'
fetch('/data/geos.json').then(resp => resp.json()).then(geos => {
    GEOS = geos;

    // exclude Telangana, the top-level state
    for (const geo of GEOS) {
        if (geo.name == 'Telangana') {
            TELANGANA = geo;
            break;
        }
    }

    for (const geo of GEOS) {
        addChildGeoIDs(geo);
    }

    // annotate each geo with its parents
    for (const geo of GEOS) {
        addParentGeos(geo, []);
    }

    for (const geo of GEOS) {
        getAllGeos(geo, ALL_GEOS);
    }

    GEOS = GEOS.filter(p => p != TELANGANA);
    ALL_GEOS = ALL_GEOS.filter(p => p != TELANGANA);

    // run app main
    main();
});