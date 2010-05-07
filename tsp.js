/*
  These are the implementation-specific parts of the original OptiMap.
*/

var tsp; // The BtTspSolver object which handles the TSP computation.
var mode;
var waypointLabels = new Array();  // Optional labels for each waypoint.
var reasons = new Array();
reasons[G_GEO_SUCCESS]            = "Success";
reasons[G_GEO_MISSING_ADDRESS]    = "Missing Address: The address was either missing or had no value.";
reasons[G_GEO_UNKNOWN_ADDRESS]    = "Unknown Address:  No corresponding geographic location could be found for the specified address.";
reasons[G_GEO_UNAVAILABLE_ADDRESS]= "Unavailable Address:  The geocode for the given address cannot be returned due to legal or contractual reasons.";
reasons[G_GEO_BAD_KEY]            = "Bad Key: The API key is either invalid or does not match the domain for which it was given";
reasons[G_GEO_TOO_MANY_QUERIES]   = "Too Many Queries: The daily geocoding quota for this site has been exceeded.";
reasons[G_GEO_SERVER_ERROR]       = "Server error: The geocoding request could not be successfully processed.";

/* Returns a textual representation of time in the format 
 * "N days M hrs P min Q sec". Does not include days if
 * 0 days etc. Does not include seconds if time is more than
 * 1 hour.
 */
function formatTime(seconds) {
  var days;
  var hours;
  var minutes;
  days = parseInt(seconds / (24*3600));
  seconds -= days * 24 * 3600;
  hours = parseInt(seconds / 3600);
  seconds -= hours * 3600;
  minutes = parseInt(seconds / 60);
  seconds -= minutes * 60;
  var ret = "";
  if (days > 0) 
    ret += days + " days ";
  if (days > 0 || hours > 0) 
    ret += hours + " hrs ";
  if (days > 0 || hours > 0 || minutes > 0) 
    ret += minutes + " min ";
  if (days == 0 && hours == 0)
    ret += seconds + " sec";
  return(ret);
}

/* Returns textual representation of distance in the format
 * "N km M m". Does not include km if less than 1 km. Does not
 * include meters if km >= 10.
 */
function formatLength(meters) {
  var km = parseInt(meters / 1000);
  meters -= km * 1000;
  var ret = "";
  if (km > 0) 
    ret += km + " km ";
  if (km < 10)
    ret += meters + " m";
  return(ret);
}

/* Returns an HTML string representing the driving directions.
 * Icons match the ones shown in the map. Addresses are used
 * as headers where available.
 */
function formatDirections(gdir, mode) {
  var addr = tsp.getAddresses();
  var order = tsp.getOrder();
  var retStr = "<table class='gebddir' border=0 cell-spacing=0>\n";
  for (var i = 0; i < gdir.getNumRoutes(); ++i) {
    var route = gdir.getRoute(i);
    var colour = "g";
    var number = i+1;
    if (number == 1)
      colour = "r";
    retStr += "\t<tr class='heading'><td class='heading' width=40>"
      + "<div class='centered-directions'><img src='icons/icon" + colour 
      + number + ".png'></div></td>"
      + "<td class='heading'><div class='centered-directions'>";
    var headerStr;
    if (waypointLabels[order[i]] != null && waypointLabels[order[i]] != "") {
      headerStr = waypointLabels[order[i]];
    } else if (addr[order[i]] != null) {
      headerStr = addr[order[i]];
    } else {
      var prevI = (i == 0) ? gdir.getNumRoutes() - 1 : i-1;
      var latLng = gdir.getRoute(prevI).getEndLatLng();
      headerStr = "(" + gdir.getGeocode(i).Point.coordinates[1] + ", " 
	+ gdir.getGeocode(i).Point.coordinates[0] + ")";
    }
    retStr += headerStr + "</div></td></tr>\n";
    for (var j = 0; j < route.getNumSteps(); ++j) {
      var classStr = "odd";
      if (j % 2 == 0) classStr = "even";
      retStr += "\t<tr class='text'><td class='" + classStr + "'></td>"
	+ "<td class='" + classStr + "'>"
	+ route.getStep(j).getDescriptionHtml() + "<div class='left-shift'>"
	+ route.getStep(j).getDistance().html + "</div></td></tr>\n";
    }
  }
  if (mode == 0) {
    var headerStr;
    if (waypointLabels[order[0]] != null && waypointLabels[order[0]] != "") {
      headerStr = waypointLabels[order[0]];
    } else if (addr[order[0]] != null) {
      headerStr = addr[order[0]];
    } else {
      var prevI = gdir.getNumRoutes() - 1;
      var latLng = gdir.getRoute(prevI).getEndLatLng();
      headerStr = "(" + latLng.lat() + ", " + latLng.lng() + ")";
    }
    retStr += "\t<tr class='heading'><td class='heading'>"
      + "<div class='centered-directions'><img src='icons/iconr1.png'></div></td>"
      + "<td class='heading'>"
      + "<div class='centered-directions'>" 
      + headerStr + "</div></td></tr>\n";
  } else if (mode == 1) {
    var headerStr;
    if (addr[order[gdir.getNumRoutes()]] == null) {
      var latLng = gdir.getRoute(gdir.getNumRoutes() - 1).getEndLatLng();
      headerStr = "(" + latLng.lat() + ", " + latLng.lng() + ")";
    } else {
      headerStr = addr[order[gdir.getNumRoutes()]];
    }
    retStr += "\t<tr class='heading'><td class='heading'>"
      + "<div class='centered-directions'><img src='icons/icong"
      + (gdir.getNumRoutes() + 1) + ".png'></div></td>"
      + "<td class='heading'>"
      + "<div class='centered-directions'>" 
      + headerStr + "</div></td></tr>\n";
  }
  retStr += "</table>";
  return(retStr);
}

function createTomTomLink(gdir) {
  var addr = tsp.getAddresses();
  var order = tsp.getOrder();
  var addr2 = new Array();
  for (var i = 0; i < order.length; ++i)
    addr2[i] = addr[order[i]];
  var itn = createTomTomItineraryItn(gdir, addr2);
  var retStr = "<form method='GET' action='tomtom.php'>\n";
  retStr += "<input type='hidden' name='itn' value='" + itn + "' />\n";
  retStr += "<input type='submit' value='Send to TomTom' />\n";
  retStr += "</form>\n";
  return retStr;
}

function drawMarker(latlng, num) {
  var icon;
  var letter = num == 1 ? 'r' : 'b';
  icon = new GIcon(G_DEFAULT_ICON, "icons/icon" + letter + num + ".png");
  icon.printImage = "icons/icon" + letter + num + ".png";
  icon.mozPrintImage = "icons/icon" + letter + num + ".gif";
  gebMap.addOverlay(new GMarker(latlng, {icon: icon }));
}

function setViewportToCover(waypoints) {
  var bounds = new GLatLngBounds();
  for (var i = 0; i < waypoints.length; ++i) {
    bounds.extend(waypoints[i]);
  }
  gebMap.setCenter(bounds.getCenter());
  gebMap.setZoom(gebMap.getBoundsZoomLevel(bounds));
}

function loadAtStart(lat, lng, zoom) {
  if (GBrowserIsCompatible()) {
    gebMap = new GMap2(document.getElementById("map"));
    directionsPanel = document.getElementById("my_textual_div");
  
    gebMap.setCenter(new GLatLng(lat, lng), zoom);
    gebMap.addControl(new GLargeMapControl());
    gebMap.addControl(new GMapTypeControl());

    tsp = new BpTspSolver(gebMap, directionsPanel);
    gebDirections = tsp.getGDirections();
    GEvent.addListener(gebDirections, "error", function() {
      alert("Request failed: " + reasons[gebDirections.getStatus().code]);
    });

    GEvent.addListener(gebMap, "click", function(marker, latLng) {
      if (marker == null) {
	tsp.addWaypoint(latLng);
	drawMarker(latLng, tsp.getWaypoints().length);
      } else {
        tsp.removeWaypoint(marker.getPoint());
        gebMap.removeOverlay(marker);
      }
    });
  }
  else {
    alert('Your browser is not compatible with this technology.\nPlease consider upgrading.');
  }
}

function addWaypointWithLabel(latLng, label) {
  waypointLabels.push(label);
  addWaypoint(latLng);
}

function addWaypoint(latLng) {
  tsp.addWaypoint(latLng);
}

function addAddressWithLabel(addr, label) {
  waypointLabels.push(label);
  addAddress(addr);
}

function addAddress(addr) {
  tsp.addAddress(addr, addAddressSuccessCallback);
}

function clickedAddAddress() {
  tsp.addAddress(document.address.addressStr.value, addAddressSuccessCallback2);
}

function addAddressSuccessCallback(address, latlng) {
  if (latlng)
    drawMarker(latlng, tsp.getWaypoints().length);
  else
    alert('Failed to geocode: ' + address);
}

function addAddressSuccessCallback2(address, latlng) {
  if (latlng) {
    drawMarker(latlng, tsp.getWaypoints().length);
    setViewportToCover(tsp.getWaypoints());
  }
  else
    alert('Failed to geocode: ' + address);
}

function startOver() {
  document.getElementById("my_textual_div").innerHTML = "";
  document.getElementById("path").innerHTML = "";
  gebMap.clearOverlays();
  tsp.startOver(); // doesn't clearOverlays or clear the directionsPanel
}

function directions(m, walking, avoid) {
  gebMap.clearOverlays();
  mode = m;
  tsp.setAvoidHighways(avoid);
  if (walking)
    tsp.setTravelMode(G_TRAVEL_MODE_WALKING);
  else
    tsp.setTravelMode(G_TRAVEL_MODE_DRIVING);
  gebMap.clearOverlays();
  if (m == 0)
    tsp.solveRoundTrip(onSolveCallback);
  else
    tsp.solveAtoZ(onSolveCallback);
}

function onSolveCallback(myTsp) {
  var dir = tsp.getGDirections();
  // Print shortest roundtrip data:
  var pathStr = "<p>Trip duration: " + formatTime(dir.getDuration().seconds) + "<br>";
  pathStr += "Trip length: " + formatLength(dir.getDistance().meters) + "</p>";
  pathStr += "<input type='button' value='Toggle raw path output' onClick='toggle(\"exportData\");'>";
  document.getElementById("path").innerHTML = pathStr;
  var durStr = "<input type='button' value='Toggle csv durations matrix' onClick='toggle(\"durationsData\");'>";
  document.getElementById("durations").innerHTML = durStr;
  document.getElementById("my_textual_div").innerHTML = formatDirections(dir, mode);
  document.getElementById("tomtom").innerHTML = createTomTomLink(dir);

  // Remove the standard google maps icons:
  for (var i = 0; i < gebDirections.getNumGeocodes(); ++i) {
    gebMap.removeOverlay(gebDirections.getMarker(i));
  }
  
  // Add nice, numbered icons instead:
  if (mode == 1) {
    var myPt1 = gebDirections.getRoute(0).getStep(0).getLatLng();
    var myIcn1 = new GIcon(G_DEFAULT_ICON,"icons/iconr1.png");
    myIcn1.printImage = "icons/iconr1.png";
    myIcn1.mozPrintImage = "icons/iconr1.gif";
    gebMap.addOverlay(new GMarker(myPt1,myIcn1));
  }
  for (var i = 0; i < gebDirections.getNumRoutes(); ++i) {
    var route = gebDirections.getRoute(i);
    var myPt1 = route.getEndLatLng();
    var myIcn1;
    if (i == gebDirections.getNumRoutes()-1 && mode == 0) {
      myIcn1 = new GIcon(G_DEFAULT_ICON,"icons/iconr1.png");
      myIcn1.printImage = "icons/iconr1.png";
      myIcn1.mozPrintImage = "icons/iconr1.gif";
    } else {
      myIcn1 = new GIcon(G_DEFAULT_ICON,"icons/icong" + (i+2) + ".png");
      myIcn1.printImage = "icons/icong" + (i+2) + ".png";
      myIcn1.mozPrintImage = "icons/icong" + (i+2) + ".gif";
    }
    gebMap.addOverlay(new GMarker(myPt1,myIcn1));
  }
  
  // Replace driving directions with custom made design:
  document.getElementById("my_textual_div").innerHTML 
    = formatDirections(gebDirections, mode); 
  
  var bestPathLatLngStr = "";
  for (var i = 0; i < gebDirections.getNumGeocodes(); ++i) {
    bestPathLatLngStr += "(" + gebDirections.getGeocode(i).Point.coordinates[1]
      + ", " + gebDirections.getGeocode(i).Point.coordinates[0] + ")\n";
  }
  document.getElementById("exportData_hidden").innerHTML = 
    "<textarea name='outputList' rows='10' cols='40'>" 
    + bestPathLatLngStr + "</textarea><br>";

  var durationsMatrixStr = "";
  var dur = tsp.getDurations();
  for (var i = 0; i < dur.length; ++i) {
    for (var j = 0; j < dur[i].length; ++j) {
      durationsMatrixStr += dur[i][j];
      if (j == dur[i].length - 1) {
        durationsMatrixStr += "\n";
      } else {
        durationsMatrixStr += ", ";
      }
    }
  }
  document.getElementById("durationsData_hidden").innerHTML = 
    "<textarea name='csvDurationsMatrix' rows='10' cols='40'>" 
    + durationsMatrixStr + "</textarea><br>";
}

function clickedAddList() {
  addList(document.listOfLocations.inputList.value);
}

function addList(listStr) {
  var listArray = listStr.split("\n");
  for (var i = 0; i < listArray.length; ++i) {
    var listLine = listArray[i];
    if (listLine.match(/\(?\s*\-?\d+\s*,\s*\-?\d+/) ||
	listLine.match(/\(?\s*\-?\d+\s*,\s*\-?\d*\.\d+/) ||
	listLine.match(/\(?\s*\-?\d*\.\d+\s*,\s*\-?\d+/) ||
	listLine.match(/\(?\s*\-?\d*\.\d+\s*,\s*\-?\d*\.\d+/)) {
      // Line looks like lat, lng.
      var cleanStr = listLine.replace(/[^\d.,-]/g, "");
      var latLngArr = cleanStr.split(",");
      if (latLngArr.length == 2) {
	var lat = parseFloat(latLngArr[0]);
	var lng = parseFloat(latLngArr[1]);
	var latLng = new GLatLng(lat, lng);
	tsp.addWaypoint(latLng);
	drawMarker(latLng, tsp.getWaypoints().length);
      }
    } else if (listLine.match(/\S+/)) {
      // Non-empty line that does not look like lat, lng. Interpret as address.
      tsp.addAddress(listLine, addAddressSuccessCallback);
    }
  }
}

