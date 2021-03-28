console.log('go bears')


var map;
var summarydata;
var summaryddataobject;
var placeids = [];

var firebaseConfig = {
  apiKey: "AIzaSyBdxiWcA4mcJJUCxbWKIGFVA-M8bVwxFXw",
  authDomain: "tbirdsalpha.firebaseapp.com",
  databaseURL: "https://tbirdsalpha.firebaseio.com",
  projectId: "tbirdsalpha",
  storageBucket: "tbirdsalpha.appspot.com",
  messagingSenderId: "407526101902",
  appId: "1:407526101902:web:4b1b0e25b29f4b0bc94adf",
  measurementId: "G-GV3Z1WMT1P"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
//lofirebase.analytics();

var database = firebase.database().ref("summary");

var text1;

var kmlLayer;

function initMap() {
  //sourcee of KML file, must be publically hosted on a website or somesuch

  var src = 'https://tbirdsalpha.web.app/GJ_2020_1.kml';

  //this just sets up the google map
  map = new google.maps.Map(document.getElementById("map"), {
    //center: { lat: 17.446325, lng: 78.423861 },
    center: { lat: 18.3894285, lng: 78.570156 },
    zoom: 19
  });

  //this loadsd the kml layer and also centers the map around layer
  kmlLayer = new google.maps.KmlLayer(src, {
    suppressInfoWindows: true, //make this false to see the description if there is any with the kml file
    preserveViewport: false, //make this true if you don't want map centered on the area
    map: map
  });

  kmlLayer.addListener('click', function(kmlEvent) {
    //this will return the lat/long of where the mouse actually clicked, and not necesarrily the LatLng of the kml file itself
    var text1 = kmlEvent.latLng.lat();
    console.log(text1);
  });

  //this seeems to be the best way to get the center of a KML layer. requires the layer to be loaded first!! 
  google.maps.event.addListener(kmlLayer, 'defaultviewport_changed', function() {
    var getCenter = kmlLayer.getDefaultViewport().getCenter();
    console.log(getCenter.lat());
    console.log(getCenter.lng());
  });

  //method to make the layer "dissapear"
  //kmlLayer.setMap(null);

  //TODO: we might need to add some more information to the existing tables, specifcallyt aounrd the lat/long of each kml file (it's not currently there). 
  // this might be a separate process that we just do beforehand
}

function startFirebase() {
  database.once('value').then(function (snapshot) {
    summarydata = snapshot.val()
    for (var key in summarydata) {
      placeids.push(key)
      //createNewPlaceOnMap(summarydata[key]["X-Co-ordinate"], summarydata[key]["Y-Co-ordinate"], key)
    }
    //createInfoBox("asdf")
    //placeids.forEach(createInfoBox)
    autocomplete(document.getElementById("myInput"), placeids);
  })

}

//adds a marker on the map
function createNewPlaceOnMap(x, y, id) {
  var myLatLng = { lat: x, lng: y };
  var marker = new google.maps.Marker({
    position: myLatLng,
    map: map,
    title: id
  });
}

function createInfoBox(id) {
  var griditem = document.createElement("div");
  griditem.setAttribute('class', 'grid-item')
  griditem.setAttribute('onClick', 'submitClick("' + id + '")')

  var placeimage = document.createElement("IMG");
  placeimage.setAttribute('class', 'thumbnail')
  placeimage.src = "3DImages/" + id + ".jpg"
  griditem.appendChild(placeimage)

  var maininfo = document.createElement("div");
  maininfo.setAttribute('class', 'maininfo');

  var title = document.createElement("div")
  title.setAttribute('class', 'title')
  title.innerHTML = summarydata[id]["Property ID"]
  maininfo.appendChild(title)

  var plotarea = document.createElement("div")
  plotarea.setAttribute('class', 'plotarea')
  plotarea.innerHTML = summarydata[id]["Plot Area"]
  maininfo.appendChild(plotarea)

  var builtarea = document.createElement("div")
  builtarea.setAttribute('class', 'builtarea')
  builtarea.innerHTML = summarydata[id]["Built-Up"]
  maininfo.appendChild(builtarea)

  griditem.appendChild(maininfo)

  var location = document.createElement("div")
  location.setAttribute('class', 'location')
  location.innerHTML = summarydata[id]["APPLICANT ADDRESSES"]
  griditem.appendChild(location)

  var outstandingfee = document.createElement("div")
  outstandingfee.setAttribute('class', 'outstandingfee')
  outstandingfee.innerHTML = summarydata[id]["Outstanding Permission Fees  ( in Rs)"]
  griditem.appendChild(outstandingfee)


  var element = document.getElementById("element")
  element.appendChild(griditem)
}

function customSearch(searchp) {
  var service = new google.maps.places.PlacesService(map);

  var request = {
    query: searchp,
    fields: ['name', 'geometry'],
  };

  service.findPlaceFromQuery(request, function (results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      for (var i = 0; i < results.length; i++) {
        console.log("uh")
        console.log(results[i]);
      }
      //map.setCenter(results[0].geometry.location);
    } else {
      console.log("uhhhhh")
    }
  });
}

async function uh(duh) {
  const Http = new XMLHttpRequest();
  const base = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
  const input = "?input=" + duh
  const types = "types=regions"
  const key = "&key=AIzaSyAQgsQzz2xn4xyNAg9YVFO0W871_AEHvHw"
  const fullQuery = base + input + types + key
  Http.open("GET", fullQuery)
  Http.send()

  Http.onreadystatechange = (e) => {
    console.log(Http.responseText)
  }
}

async function uh2(duh) {
  const base = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
  const input = "?input=" + duh
  const types = "?types=regions"
  const key = "&key=AIzaSyAQgsQzz2xn4xyNAg9YVFO0W871_AEHvHw"
  const fullQuery = base + input + types + key

  // $.getJSON(fullQuery, function (result) {
  //   console.log(result)
  // })

  // $.get(fullQuery).done(function (data) {
  //   console.log(data);
  // });

  console.log(fullQuery)

  bruh2 = "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=7&key=AIzaSyAQgsQzz2xn4xyNAg9YVFO0W871_AEHvHw"
  $.getJSON(bruh2, function (result) {
    console.log(result)
  })

}

function uh3(duh) {
  const url = "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=7&key=AIzaSyAQgsQzz2xn4xyNAg9YVFO0W871_AEHvHw"
  fetch(url).then(data => { return data.json() }).then(res => { console.log(res) })
}

function uh4(duh) {
  const url = "https://maps.googleapis.com/maps/api/place/autocomplete/json?input=7&key=AIzaSyAQgsQzz2xn4xyNAg9YVFO0W871_AEHvHw"
  axios.get(url)
    .then(data => console.log(data))
    .then(err => console.log(err))
}

// autocomplete section
function autocomplete(inp, arr) {
  /*the autocomplete function takes two arguments,
  the text field element and an array of possible autocompleted values:*/
  var currentFocus;
  /*execute a function when someone writes in the text field:*/
  inp.addEventListener("input", function (e) {
    var a, b, i, val = this.value;
    /*close any already open lists of autocompleted values*/
    closeAllLists();
    if (!val) { return false; }
    currentFocus = -1;
    /*create a DIV element that will contain the items (values):*/
    a = document.createElement("DIV");
    a.setAttribute("id", this.id + "autocomplete-list");
    a.setAttribute("class", "autocomplete-items");
    /*append the DIV element as a child of the autocomplete container:*/
    this.parentNode.appendChild(a);

    var boxcount = 0;
    /*for each item in the array...*/
    for (i = 0; i < arr.length; i++) {
      /*check if the item starts with the same letters as the text field value:*/
      if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
        /*create a DIV element for each matching element:*/
        boxcount++;
        //limits how many searches show up
        if (boxcount<8) {
          b = document.createElement("DIV");
          /*make the matching letters bold:*/
          b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
          b.innerHTML += arr[i].substr(val.length);
          /*insert a input field that will hold the current array item's value:*/
          b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
          /*execute a function when someone clicks on the item value (DIV element):*/
          b.addEventListener("click", function (e) {
            /*insert the value for the autocomplete text field:*/
            inp.value = this.getElementsByTagName("input")[0].value;

            //shows the box after a search is selected
            createInfoBox(this.getElementsByTagName("input")[0].value)


            /*close the list of autocompleted values,
            (or any other open lists of autocompleted values:*/
            closeAllLists();
          });
          a.appendChild(b);
        }
      }
    }
  });
  /*execute a function presses a key on the keyboard:*/
  inp.addEventListener("keydown", function (e) {
    var x = document.getElementById(this.id + "autocomplete-list");
    if (x) x = x.getElementsByTagName("div");
    if (e.keyCode == 40) {
      /*If the arrow DOWN key is pressed,
      increase the currentFocus variable:*/
      currentFocus++;
      /*and and make the current item more visible:*/
      addActive(x);
    } else if (e.keyCode == 38) { //up
      /*If the arrow UP key is pressed,
      decrease the currentFocus variable:*/
      currentFocus--;
      /*and and make the current item more visible:*/
      addActive(x);
    } else if (e.keyCode == 13) {
      /*If the ENTER key is pressed, prevent the form from being submitted,*/
      e.preventDefault();
      if (currentFocus > -1) {
        /*and simulate a click on the "active" item:*/
        if (x) x[currentFocus].click();
      }
    }
  });
  function addActive(x) {
    /*a function to classify an item as "active":*/
    if (!x) return false;
    /*start by removing the "active" class on all items:*/
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    /*add class "autocomplete-active":*/
    x[currentFocus].classList.add("autocomplete-active");
  }
  function removeActive(x) {
    /*a function to remove the "active" class from all autocomplete items:*/
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  function closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }
  /*execute a function when someone clicks in the document:*/
  document.addEventListener("click", function (e) {
    closeAllLists(e.target);
  });
}

function submitClick(e) {
  console.log(e)
}

function showPopupInfo() {

}

startFirebase()

// function loadJSON(text) {
//   var request = new XMLHttpRequest();
//    request.open("GET", text, false);
//    request.send(null)
//    summarydata = JSON.parse(request.responseText);
// }

// function loadJSON2() {
//   $.getJSON("sample.json", function(json) {
//     console.log(json); // this will show the info it in firebug console
//     summarydata = json
// });
// }

// function sendData() {
//   database.child("summary").set(summarydata);
// }