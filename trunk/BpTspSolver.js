/*
  This reasonably encapsulates reusable functionality for resolving TSP problems, and uses
    a subset of the code from the original OptiMap Google Map TSP Solver.
  The author of this refactoring is James Tolley <info [at] gmaptools.com>
      Please contact me if you are planning on using this code.
  The author of the original code is Geir K. Engdahl <geir.engdahl (at) gmail.com>

  version 0.9; 08/30/08

  // Usage:
  var tsp = new BpTsp(map?, panel?, onFatalError?); // if these are passed, they will be updated (as GDirections)

  tsp.addWaypoint(latLng); // no reverse geocode, so no callback
  tsp.addAddress(addressStr, onGeocode);
  // ... up to and including 24 locations total

  var bool = tsp.isReady(); // are all of the addresses geocoded?

  // will update the map and/or panel if they were passed in the constructor
  // if there are geocodes outstanding, these will wait until they're all retrieved and then run
  tsp.solveRoundTrip(callback); // or:
  tsp.solveAtoZ(callback);

  // other methods:
  tsp.startOver(); // restores original state, aside from the original arguments: map, panel, and onFatalError
  var addrs_array = tsp.getAddresses();
  var wpts_array  = tsp.getWaypoints();
  var success = tsp.removeAddress(addr);
  var success = tsp.removeWaypoint(wpt);
  var gdir = tsp.getGDirections();

  function callback(tsp) {
    var dirs      = tsp.getGDirections(); // low-level control
  }

  function onFatalError(tsp, errMsg) {
    alert('Cannot continue after ' + errMsg + '. Call tsp.startOver() to continue.');
  }

  function onGeocode(address, latlng) {
    if (latlng)
      alert(address + ' found: ' + latlng.toString());
    else
      alert(address + ' not found!');
  }

*/

(function() {

/* The author of the code below code is Geir K. Engdahl, and can be reached
 * at geir.engdahl (at) gmail.com
 * 
 * If you intend to use the code or derive code from it, please
 * consult with the author.
 */ 
var tsp; // singleton
var gebMap;           // The map DOM object
var directionsPanel;  // The driving directions DOM object
var gebDirections;    // The driving directions returned from GMAP API
var gebGeocoder;      // The geocoder for addresses
var maxTspSize = 24;  // A limit on the size of the problem, mostly to save Google servers from undue load.
var maxTspBF = 0;     // Max size for brute force, may seem conservative, but ma
var maxTspDynamic = 15;     // Max size for brute force, may seem conservative, but many browsers have limitations on run-time.
var maxSize = 24;     // Max number of waypoints in one Google driving directions request.
var maxTripSentry = 2000000000; // Approx. 63 years., this long a route should not be reached...
var avoidHighways = false; // Whether to avoid highways. False by default.
var travelMode = G_TRAVEL_MODE_DRIVING; // or G_TRAVEL_MODE_WALKING
var distIndex;
var reasons = new Array();
reasons[G_GEO_SUCCESS]            = "Success";
reasons[G_GEO_BAD_REQUEST]        = "Bad Request: A directions request could not be successfully parsed.";
reasons[G_GEO_SERVER_ERROR]       = "Server error: The geocoding request could not be successfully processed.";
reasons[G_GEO_MISSING_QUERY]      = "Missing Query: The HTTP q parameter was either missing or had no value.";
reasons[G_GEO_MISSING_ADDRESS]    = "Missing Address: The address was either missing or had no value.";
reasons[G_GEO_UNKNOWN_ADDRESS]    = "Unknown Address:  No corresponding geographic location could be found for the specified address.";
reasons[G_GEO_UNAVAILABLE_ADDRESS]= "Unavailable Address:  The geocode for the given address cannot be returned due to legal or contractual reasons.";
reasons[G_GEO_BAD_KEY]            = "Bad Key: The API key is either invalid or does not match the domain for which it was given";
reasons[G_GEO_TOO_MANY_QUERIES]   = "Too Many Queries: The daily geocoding quota for this site has been exceeded.";
reasons[G_GEO_UNKNOWN_DIRECTIONS] = "Unknown Directions: The GDirections object could not compute directions between the points mentioned in the query.";
var waypoints = new Array();
var addresses = new Array();
var addr = new Array();
var wpActive = new Array();
var addressRequests = 0;
var wayStr;
var distances;
var durations;
var dist;
var dur;
var visited;
var currPath;
var bestPath;
var bestTrip;
var nextSet;
var numActive;
var chunkNode;
var cachedDirections = false;

var onSolveCallback = function(){};
var originalOnFatalErrorCallback = function(tsp, errMsg) { alert("Request failed: " + errMsg); }
var onFatalErrorCallback = originalOnFatalErrorCallback;
var doNotContinue = false;
var onLoadListener = null;
var onFatalErrorListener = null;

/* Computes a near-optimal solution to the TSP problem, 
 * using Ant Colony Optimization and local optimization
 * in the form of k2-opting each candidate route.
 * Run time is O(numWaves * numAnts * numActive ^ 2) for ACO
 * and O(numWaves * numAnts * numActive ^ 3) for rewiring?
 * 
 * if mode is 1, we start at node 0 and end at node numActive-1.
 */
function tspAntColonyK2(mode) {
  var alfa = 1.0; // The importance of the previous trails
  var beta = 1.0; // The importance of the durations
  var rho = 0.1;  // The decay rate of the pheromone trails
  var asymptoteFactor = 0.9; // The sharpness of the reward as the solutions approach the best solution
  var pher = new Array();
  var nextPher = new Array();
  var prob = new Array();
  var numAnts = 10;
  var numWaves = 10;
  for (var i = 0; i < numActive; ++i) {
    pher[i] = new Array();
    nextPher[i] = new Array();
  }
  for (var i = 0; i < numActive; ++i) {
    for (var j = 0; j < numActive; ++j) {
      pher[i][j] = 1;
      nextPher[i][j] = 0.0;
    }
  }

  var lastNode = 0;
  var startNode = 0;
  var numSteps = numActive - 1;
  var numValidDests = numActive;
  if (mode == 1) {
    lastNode = numActive - 1;
    numSteps = numActive - 2;
    numValidDests = numActive - 1;
  }
  for (var wave = 0; wave < numWaves; ++wave) {
    for (var ant = 0; ant < numAnts; ++ant) {
      var curr = startNode;
      var currDist = 0;
      for (var i = 0; i < numActive; ++i) {
        visited[i] = false;
      }
      currPath[0] = curr;
      for (var step = 0; step < numSteps; ++step) {
      	visited[curr] = true;
      	var cumProb = 0.0;
      	for (var next = 1; next < numValidDests; ++next) {
      	  if (!visited[next]) {
      	    prob[next] = Math.pow(pher[curr][next], alfa) * 
      	      Math.pow(dur[curr][next], 0.0 - beta);
      	    cumProb += prob[next];
      	  }
      	}
      	var guess = Math.random() * cumProb;
      	var nextI = -1;
      	for (var next = 1; next < numValidDests; ++next) {
      	  if (!visited[next]) {
      	    nextI = next;
      	    guess -= prob[next];
      	    if (guess < 0) {
      	      nextI = next;
      	      break;
      	    }
      	  }
      	}
      	currDist += dur[curr][nextI];
      	currPath[step+1] = nextI;
      	curr = nextI;
      }
      currPath[numSteps+1] = lastNode;
      currDist += dur[curr][lastNode];
      
      // k2-rewire:
      var lastStep = numActive;
      if (mode == 1) {
        lastStep = numActive - 1;
      }
      var changed = true;
      var i = 0;
      while (changed) {
      	changed = false;
      	for (; i < lastStep - 2 && !changed; ++i) {
      	  var cost = dur[currPath[i+1]][currPath[i+2]];
      	  var revCost = dur[currPath[i+2]][currPath[i+1]];
      	  var iCost = dur[currPath[i]][currPath[i+1]];
      	  var tmp, nowCost, newCost;
      	  for (var j = i+2; j < lastStep && !changed; ++j) {
      	    nowCost = cost + iCost + dur[currPath[j]][currPath[j+1]];
      	    newCost = revCost + dur[currPath[i]][currPath[j]]
      	      + dur[currPath[i+1]][currPath[j+1]];
      	    if (nowCost > newCost) {
      	      currDist += newCost - nowCost;
      	      // Reverse the detached road segment.
      	      for (var k = 0; k < Math.floor((j-i)/2); ++k) {
      		tmp = currPath[i+1+k];
      		currPath[i+1+k] = currPath[j-k];
      		currPath[j-k] = tmp;
      	      }
      	      changed = true;
      	      --i;
      	    }
      	    cost += dur[currPath[j]][currPath[j+1]];
      	    revCost += dur[currPath[j+1]][currPath[j]];
      	  }
      	}
      }

      if (currDist < bestTrip) {
      	bestPath = currPath;
      	bestTrip = currDist;
      }
      for (var i = 0; i <= numSteps; ++i) {
      	nextPher[currPath[i]][currPath[i+1]] += (bestTrip - asymptoteFactor * bestTrip) / (numAnts * (currDist - asymptoteFactor * bestTrip));
      }
    }
    for (var i = 0; i < numActive; ++i) {
      for (var j = 0; j < numActive; ++j) {
      	pher[i][j] = pher[i][j] * (1.0 - rho) + rho * nextPher[i][j];
      	nextPher[i][j] = 0.0;
      }
    }
  }
}

/* Returns the optimal solution to the TSP problem.
 * Run-time is O((numActive-1)!).
 * Prerequisites: 
 * - numActive contains the number of locations
 * - dur[i][j] contains weight of edge from node i to node j
 * - visited[i] should be false for all nodes
 * - bestTrip is set to a very high number
 *
 * If mode is 1, it will return the optimal solution to the related
 * problem of finding a path from node 0 to node numActive - 1, visiting
 * the in-between nodes in the best order.
 */
function tspBruteForce(mode, currNode, currLen, currStep) {
  // Set mode parameters:
  var numSteps = numActive;
  var lastNode = 0;
  var numToVisit = numActive;
  if (mode == 1) {
    numSteps = numActive - 1;
    lastNode = numActive - 1;
    numToVisit = numActive - 1;
  }

  // If this route is promising:
  if (currLen + dur[currNode][lastNode] < bestTrip) {

    // If this is the last node:
    if (currStep == numSteps) {
      currLen += dur[currNode][lastNode];
      currPath[currStep] = lastNode;
      bestTrip = currLen;
      for (var i = 0; i <= numSteps; ++i) {
        bestPath[i] = currPath[i];
      }
    } else {

      // Try all possible routes:
      for (var i = 1; i < numToVisit; ++i) {
        if (!visited[i]) {
          visited[i] = true;
          currPath[currStep] = i;
          tspBruteForce(mode, i, currLen+dur[currNode][i], currStep+1);
          visited[i] = false;
        }
      }
    }
  }
}

/* Finds the next integer that has num bits set to 1.
 */
function nextSetOf(num) {
  var count = 0;
  var ret = 0;
  for (var i = 0; i < numActive; ++i) {
    count += nextSet[i];
  }
  if (count < num) {
    for (var i = 0; i < num; ++i) {
      nextSet[i] = 1;
    }
    for (var i = num; i < numActive; ++i) {
      nextSet[i] = 0;
    }
  } else {
    // Find first 1
    var firstOne = -1;
    for (var i = 0; i < numActive; ++i) {
      if (nextSet[i]) {
	firstOne = i;
	break;
      }
    }
    // Find first 0 greater than firstOne
    var firstZero = -1;
    for (var i = firstOne + 1; i < numActive; ++i) {
      if (!nextSet[i]) {
	firstZero = i;
	break;
      }
    }
    if (firstZero < 0) {
      return -1;
    }
    // Increment the first zero with ones behind it
    nextSet[firstZero] = 1;
    // Set the part behind that one to its lowest possible value
    for (var i = 0; i < firstZero - firstOne - 1; ++i) {
      nextSet[i] = 1;
    }
    for (var i = firstZero - firstOne - 1; i < firstZero; ++i) {
      nextSet[i] = 0;
    }
  }
  // Return the index for this set
  for (var i = 0; i < numActive; ++i) {
    ret += (nextSet[i]<<i);
  }
  return ret;
}

/* Solves the TSP problem to optimality. Memory requirement is
 * O(numActive * 2^numActive)
 */
function tspDynamic(mode) {
  var numCombos = 1<<numActive;
  var C = new Array();
  var parent = new Array();
  for (var i = 0; i < numCombos; ++i) {
    C[i] = new Array();
    parent[i] = new Array();
    for (var j = 0; j < numActive; ++j) {
      C[i][j] = 0.0;
      parent[i][j] = 0;
    }
  }
  for (var k = 1; k < numActive; ++k) {
    var index = 1 + (1<<k);
    C[index][k] = dur[0][k];
  }
  for (var s = 3; s <= numActive; ++s) {
    for (var i = 0; i < numActive; ++i) {
      nextSet[i] = 0;
    }
    var index = nextSetOf(s);
    while (index >= 0) {
      for (var k = 1; k < numActive; ++k) {
	if (nextSet[k]) {
	  var prevIndex = index - (1<<k);
	  C[index][k] = maxTripSentry;
	  for (var m = 1; m < numActive; ++m) {
	    if (nextSet[m] && m != k) {
	      if (C[prevIndex][m] + dur[m][k] < C[index][k]) {
		C[index][k] = C[prevIndex][m] + dur[m][k];
		parent[index][k] = m;
	      }
	    }
	  }
	}
      }
      index = nextSetOf(s);
    }
  }
  for (var i = 0; i < numActive; ++i) {
    bestPath[i] = 0;
  }
  var index = (1<<numActive)-1;
  if (mode == 0) {
    var currNode = -1;
    bestPath[numActive] = 0;
    for (var i = 1; i < numActive; ++i) {
      if (C[index][i] + dur[i][0] < bestTrip) {
	bestTrip = C[index][i] + dur[i][0];
	currNode = i;
      }
    }
    bestPath[numActive-1] = currNode;
  } else {
    var currNode = numActive - 1;
    bestPath[numActive-1] = numActive - 1;
    bestTrip = C[index][numActive-1];
  }
  for (var i = numActive - 1; i > 0; --i) {
    currNode = parent[index][currNode];
    index -= (1<<bestPath[i]);
    bestPath[i-1] = currNode;
  }
}  

function makeLatLng(latLng) {
  return(latLng.toString().substr(1,latLng.toString().length-2));
}

function getWayStr(curr) {
  //  alert("getWayStr(" + curr + ")");
  var nextAbove = -1;
  for (var i = curr + 1; i < waypoints.length; ++i) {
    if (wpActive[i]) {
      if (nextAbove == -1) {
        nextAbove = i;
      } else {
        wayStr.push(makeLatLng(waypoints[i]));
        wayStr.push(makeLatLng(waypoints[curr]));
      }
    }
  }
  if (nextAbove != -1) {
    wayStr.push(makeLatLng(waypoints[nextAbove]));
    getWayStr(nextAbove);
    wayStr.push(makeLatLng(waypoints[curr]));
  }
}

function getDistTable(curr, currInd) {
  var nextAbove = -1;
  var index = currInd;
  for (var i = curr + 1; i < waypoints.length; ++i) {
    if (wpActive[i]) {
      index++;
      if (nextAbove == -1) {
        nextAbove = i;
      } else {
        dist[currInd][index] = distances[distIndex];
        dur[currInd][index] = durations[distIndex++];
        dist[index][currInd] = distances[distIndex];
        dur[index][currInd] = durations[distIndex++];
      }
    }
  }
  if (nextAbove != -1) {
    dist[currInd][currInd+1] = distances[distIndex];
    dur[currInd][currInd+1] = durations[distIndex++];
    getDistTable(nextAbove, currInd+1);
    dist[currInd+1][currInd] = distances[distIndex];
    dur[currInd+1][currInd] = durations[distIndex++];
  }
}

function directions(mode) {
  if (cachedDirections) {
    // Bypass Google directions lookup if we already have the distance
    // and duration matrices.
    doTsp(mode);
  }
  wayStr = new Array();
  numActive = 0;
  for (var i = 0; i < waypoints.length; ++i) {
    if (wpActive[i]) ++numActive;
  }

  for (var i = 0; i < waypoints.length; ++i) {
    if (wpActive[i]) {
      wayStr.push(makeLatLng(waypoints[i]));
      getWayStr(i);
      break;
    }
  }

  // Roundtrip
  if (numActive > maxTspSize) {
    alert("Too many locations! You have " + numActive + ", but max limit is " + maxTspSize);
  } else {  
    distances = new Array();
    durations = new Array();
    chunkNode = 0;
    nextChunk(mode);
  }     
}

function nextChunk(mode) {
  if (chunkNode < wayStr.length) {
    var wayStrChunk = new Array();
    for (var i = 0; i < maxSize && i + chunkNode < wayStr.length; ++i) {
      wayStrChunk.push(wayStr[chunkNode+i]);
    }
    chunkNode += maxSize;
    if (chunkNode < wayStr.length-1) {
      chunkNode--;
    }

    var myGebDirections = new GDirections(gebMap, directionsPanel);
  
    GEvent.addListener(myGebDirections, "error", function() {
      alert(myGebDirections.getStatus().code);
      var errorMsg = reasons[myGebDirections.getStatus().code];
      if (typeof errorMsg == 'undefined') errorMsg = 'Unknown error.';
      var doNotContinue = true;
      onFatalErrorCallback(tsp, errorMsg);
    });

    GEvent.addListener(myGebDirections, "load", function() {
    	// Save distances and durations
    	for (var i = 0; i < myGebDirections.getNumRoutes(); ++i) {
    	  durations.push(myGebDirections.getRoute(i).getDuration().seconds);
    	  distances.push(myGebDirections.getRoute(i).getDistance().meters);
    	}
    	nextChunk(mode);
    });

    GEvent.addListener(myGebDirections, "addoverlay", function() {      
	// Remove the standard google maps icons:
	gebMap.clearOverlays();
	directionsPanel.innerHTML = "";
      });

    myGebDirections.loadFromWaypoints(wayStrChunk, { getSteps:false, getPolyline:false, preserveViewport:true, avoidHighways:avoidHighways, travelMode:travelMode });
  } else {
    readyTsp(mode);
  }
}

function readyTsp(mode) {
  // Get distances and durations into 2-d arrays:
  distIndex = 0;
  dist = new Array();
  dur = new Array();
  numActive = 0;
  for (var i = 0; i < waypoints.length; ++i) {
    if (wpActive[i]) {
      dist.push(new Array());
      dur.push(new Array());
      addr[numActive] = addresses[i];
      numActive++;
    }
  }
  for (var i = 0; i < numActive; ++i) {
    dist[i][i] = 0;
    dur[i][i] = 0;
  }
  for (var i = 0; i < waypoints.length; ++i) {
    if (wpActive[i]) {
      getDistTable(i, 0);
      break;
    }
  }

  doTsp(mode);
}

function doTsp(mode) {
  // Calculate shortest roundtrip:
  visited = new Array();
  for (var i = 0; i < numActive; ++i) {
    visited[i] = false;
  }
  currPath = new Array();
  bestPath = new Array();
  nextSet = new Array();
  bestTrip = maxTripSentry;
  visited[0] = true;
  currPath[0] = 0;
  cachedDirections = true;
  if (numActive <= maxTspBF + mode) {
    tspBruteForce(mode, 0, 0, 1);
  } else if (numActive <= maxTspDynamic + mode) {
    tspDynamic(mode);
  } else {
    tspAntColonyK2(mode);
  }

  wayStrChunk = new Array();
  var wpIndices = new Array();
  for (var i = 0; i < waypoints.length; ++i) {
    if (wpActive[i]) {
      wpIndices.push(i);
    }
  }
  var bestPathLatLngStr = "";
  for (var i = 0; i < bestPath.length; ++i) {
    //    alert(bestPath[i]);
    wayStrChunk.push(makeLatLng(waypoints[wpIndices[bestPath[i]]]));
    bestPathLatLngStr += makeLatLng(waypoints[wpIndices[bestPath[i]]]) + "\n";
  }
  if (typeof onSolveCallback == 'function') {
    if (onLoadListener)
      GEvent.removeListener(onLoadListener);

    onLoadListener = GEvent.addListener(gebDirections, 'addoverlay', function(){
      onSolveCallback(tsp);
    });
  }

  if (onFatalErrorListener)
    GEvent.removeListener(onFatalErrorListener);
  onFatalErrorListener = GEvent.addListener(gebDirections, 'error', onFatalErrorCallback)

  gebDirections.loadFromWaypoints(wayStrChunk, {getSteps:true, getPolyline:true, preserveViewport:false, avoidHighways:avoidHighways, travelMode:travelMode});
}

function addWaypoint(latLng) {
  var freeInd = -1;
  for (var i = 0; i < waypoints.length; ++i) {
    if (!wpActive[i]) {
      freeInd = i;
      break;
    }
  }
  if (freeInd == -1) {
    if (waypoints.length < maxTspSize) {
      waypoints.push(latLng);
      wpActive.push(true);
      freeInd = waypoints.length-1;
    } else {
      return(-1);
    }
  } else {
    waypoints[freeInd] = latLng;
    wpActive[freeInd] = true;
  }
  return(freeInd);
}

function addAddress(address, callback) {
  addressRequests++;
  gebGeocoder.getLatLng(address, function(latLng) {
    addressRequests--;
    if (!latLng) {
      if (typeof(callback) == 'function')
        callback(address);
    } else {
    	var freeInd = addWaypoint(latLng);
    	addresses[freeInd] = address;
      if (typeof callback == 'function')
        callback(address, latLng);
    }
  });
}

BpTspSolver.prototype.startOver = function() {
  waypoints = new Array();
  addresses = new Array();
  addr = new Array();
  wpActive = new Array();
  wayStr = "";
  distances = new Array();
  durations = new Array();
  dist = new Array();
  dur = new Array();
  visited = new Array();
  currPath = new Array();
  bestPath = new Array();
  bestTrip = new Array();
  nextSet = new Array();
  numActive = 0;
  chunkNode = 0;
  addressRequests = 0;
  cachedDirections = false;
  onSolveCallback = function(){};
  doNotContinue = false;
}
    
/* end (edited) OptiMap code */
/* start public interface */

function BpTspSolver(map, panel, onFatalError) {
  if (tsp) {
    alert('You can only create one BpTspSolver at a time.');
    return;
  }

  gebMap               = map;
  directionsPanel      = panel;
  gebGeocoder          = new GClientGeocoder();
  gebDirections        = new GDirections(gebMap, directionsPanel);
  onFatalErrorCallback = onFatalError; // only for errors fatal errors, not geocoding errors
  tsp                  = this;
}

BpTspSolver.prototype.addAddress = function(address, callback) {
  if (!this.isReady()) {
    setTimeout(function(){ tsp.addAddress(address, callback) }, 20);
    return;
  }
  addAddress(address, callback);
};

BpTspSolver.prototype.addWaypoint = function(latLng) {
  addWaypoint(latLng);
};

BpTspSolver.prototype.getWaypoints = function() {
  var wp = [];
  for (var i = 0; i < waypoints.length; i++) {
    if (wpActive[i])
      wp.push(waypoints[i]);
  }
  return wp;
};

BpTspSolver.prototype.getAddresses = function() {
  var addrs = [];
  for (var i = 0; i < addresses.length; i++) {
    if (wpActive[i])
      addrs.push(addresses[i]);
  }
  return addrs;
};

BpTspSolver.prototype.removeWaypoint = function(latLng) {
  for (var i = 0; i < waypoints.length; ++i) {
    if (wpActive[i] && waypoints[i].equals(latLng)) {
      wpActive[i] = false;
      return true;
    }
  }
  return false;
};

BpTspSolver.prototype.removeAddress = function(addr) {
  for (var i = 0; i < addresses.length; ++i) {
    if (wpActive[i] && addresses[i] == addr) {
      wpActive[i] = false;
      return true;
    }
  }
  return false;
};

BpTspSolver.prototype.getGDirections = function() {
  return gebDirections;
};

// Returns the order that the input locations was visited in.
//   getOrder()[0] is always the starting location.
//   getOrder()[1] gives the first location visited, getOrder()[2]
//   gives the second location visited and so on.
BpTspSolver.prototype.getOrder = function() {
  return bestPath;
}

// Methods affecting the way driving directions are computed
BpTspSolver.prototype.getAvoidHighways = function() {
  return avoidHighways;
}

BpTspSolver.prototype.setAvoidHighways = function(avoid) {
  avoidHighways = avoid;
}

BpTspSolver.prototype.getTravelMode = function() {
  return travelMode;
}

BpTspSolver.prototype.setTravelMode = function(travelM) {
  travelMode = travelM;
}

BpTspSolver.prototype.getDurations = function() {
  return dur;
}

// we assume that we have enough waypoints
BpTspSolver.prototype.isReady = function() {
  return addressRequests == 0;
};

BpTspSolver.prototype.solveRoundTrip = function(callback) {
  if (doNotContinue) {
    alert('Cannot continue after fatal errors.');
    return;
  }

  if (!this.isReady()) {
    setTimeout(function(){ tsp.solveRoundTrip(callback) }, 20);
    return;
  }
  if (typeof callback == 'function')
    onSolveCallback = callback;

  directions(0);
};

BpTspSolver.prototype.solveAtoZ = function(callback) {
  if (doNotContinue) {
    alert('Cannot continue after fatal errors.');
    return;
  }

  if (!this.isReady()) {
    setTimeout(function(){ tsp.solveAtoZ(callback) }, 20);
    return;
  }

  if (typeof callback == 'function')
    onSolveCallback = callback;

  directions(1);
};

window.BpTspSolver = BpTspSolver;
  
})();
