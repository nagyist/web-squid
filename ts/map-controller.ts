/// <reference path="squid-hsi.ts"/>
/// <reference path="typings/jquery/jquery.d.ts"/>
/// <reference path="typings/threejs/three.d.ts"/>
/// <reference path="lib/jsdap.d.ts"/>

module squid {
app.controller('MapController', ['$scope', function($scope) {
  var debugMode = false;
  // initialize renderer
  var stage = $('div#stage');
  stage.css({
    "height": "400px",
    "width": "400px"
    });
  var renderer = new THREE.WebGLRenderer(),
      rendererWidth  = stage.innerWidth(),
      rendererHeight = stage.innerHeight();
  renderer.setSize(rendererWidth, rendererHeight);
  renderer.setClearColor(<any>0xffffff, 1.0);
  stage.append(renderer.domElement);

  // initialize camera
  var zoom = 80,
      camerax = 230,
      cameray = 162;
  var camera = new THREE.OrthographicCamera(rendererWidth/-zoom, rendererWidth/zoom, rendererHeight/zoom, rendererHeight/-zoom, 1, 1000);
  camera.position.set(camerax, cameray, 1);
  camera.lookAt(new THREE.Vector3(camerax, cameray, 0));

  // initialize scene
  var scene = new THREE.Scene();

  // mercator projection
  var mercatrProjection = (function () {
    var _r = 128 / Math.PI;
    var _lonToX = function(lon) {
      var lonRad = Math.PI / 180 * lon;
      return _r * (lonRad + Math.PI);
    };
    var _latToY = function (lat) {
      var latRad = Math.PI / 180 * lat;
      return _r / 2 * Math.log((1.0 + Math.sin(latRad))/(1.0 - Math.sin(latRad))) + 128;
    };

    return {
      lonToX: _lonToX,
      latToY: _latToY,
      lonArrToX: function (lonArr) {
        var arr = [];
        for (var i = lonArr.length; i--;) {
          arr[i] = _lonToX(lonArr[i]);
        }
        return arr;
      },
      latArrToY: function (latArr) {
        var arr = [];
        for (var i = latArr.length; i--;) {
          arr[i] = _latToY(latArr[i]);
        }
        return arr;
      }
    }
  })();

  var drawCoastLine = function () {
    // load gml
    var gml;
    $.ajax({
      url: "data/coastl_jpn.gml",
      dataType: "xml",
      async: false,
      error: function () { alert('Error loading XML document'); },
      success: function (data) { gml = data; }
    });

    // draw coast line
    var material = new THREE.LineBasicMaterial({ color: 0x000000 });
    $(gml).find('coastl').each(function() {
      var posList = $(this).find('posList')[0].innerHTML.split(' ');
      var geometry = new THREE.Geometry();
      for (var i = 0, len = posList.length; i < len - 1; i += 2) {
        var vertice = new THREE.Vector3(mercatrProjection.lonToX(posList[i + 1]), mercatrProjection.latToY(posList[i]), 0);
        geometry.vertices.push(vertice);
      }
      var line = new THREE.Line(geometry, material);
      scene.add(line);
    });
  };

  var drawGrid = function (xList, yList) {
    var material = new THREE.LineBasicMaterial({ color: 0xaaaaaa }),
        geometry, x, y, vertice, line,
        xmin = xList[0], xmax = xList[xList.length-1],
        ymin = yList[0], ymax = yList[yList.length-1];

    for (var i = xList.length; i--;) {
      geometry = new THREE.Geometry();
      x = xList[i];
      vertice = new THREE.Vector3(x, ymin, -0.5);
      geometry.vertices.push(vertice);
      vertice = new THREE.Vector3(x, ymax, -0.5);
      geometry.vertices.push(vertice);
      line = new THREE.Line(geometry, material);
      scene.add(line);
    }

    for (var i = yList.length; i--;) {
      geometry = new THREE.Geometry();
      y = yList[i];
      vertice = new THREE.Vector3(xmin, y, -0.5);
      geometry.vertices.push(vertice);
      vertice = new THREE.Vector3(xmax, y, -0.5);
      geometry.vertices.push(vertice);
      line = new THREE.Line(geometry, material);
      scene.add(line);
    }
  };

  var paint = function (values, xList, yList) {
    var geo = new THREE.Geometry();

    var cnt = 0;
    var _createTriagle = function (vList, cList) {
      for (var i = 0; i < 3; i++) {
        geo.vertices.push(new THREE.Vector3(vList[i][0], vList[i][1], -1));
      }
      var vNum = 3 * cnt;
      geo.faces.push(new THREE.Face3(vNum, vNum + 1, vNum + 2));
      for (var i = 0; i < 3; i++) {
        geo.faces[cnt].vertexColors[i] = new THREE.Color(cList[i]);
      }
      cnt++;
    };

    var _createSquare = function (vList, cList) {
      _createTriagle([vList[0], vList[1], vList[2]], [cList[0], cList[1], cList[2]]);
      _createTriagle([vList[0], vList[3], vList[2]], [cList[0], cList[3], cList[2]]);
    };

    // num to color
    var max = 0, min;
    for (var i = values.length - 1; i >= 0; i--) {
      var val =  $.grep(values[i], function(e){return e;});
      var maxPerLat = d3.max(val);
      var minPerLat = d3.min(val);
      if (maxPerLat > max) max = maxPerLat;
      if (min > minPerLat || minPerLat < 1 || min == undefined) min = minPerLat;
    }
    var scale = d3.scale.linear()
                  .domain([min, max])
                  .range([240, 360]);
    var _numTo16Color = function (num) {
      if (num < 30){
        return d3.hsl("hsl(100,100%,100%)").toString();
      }
      return d3.hsl("hsl("+scale(num)+",50%,50%)").toString();
    };

    for (var xi = 0, xLen = xList.length - 1; xi < xLen; xi++) {
      for (var yi = 0, yLen = yList.length - 1; yi < yLen; yi++) {
        var vList = [
          [xList[xi], yList[yi]],
          [xList[xi + 1], yList[yi]],
          [xList[xi + 1], yList[yi + 1]],
          [xList[xi], yList[yi + 1]]
        ];
        var cList = [
          _numTo16Color(values[yi][xi]),
          _numTo16Color(values[yi][xi + 1]),
          _numTo16Color(values[yi + 1][xi + 1]),
          _numTo16Color(values[yi + 1][xi])
        ];
        _createSquare(vList, cList);
      }
    }

    var material = new THREE.MeshBasicMaterial({
        vertexColors:THREE.VertexColors,
        side:THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);
  }

  // render
  var render = function() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
  };

  function main () {
    loadData('data/s.nc.dods', function(data) {
      var _data = data[0];
      var values = _data[0][0][0];
      var xList = mercatrProjection.lonArrToX(_data[4]);
      var yList = mercatrProjection.latArrToY(_data[3]);
      if (debugMode) drawGrid(xList, yList);
      paint(values, xList, yList);
    });
    drawCoastLine();
    render();
  }

  main();
  console.log(scene);
  }]);
}