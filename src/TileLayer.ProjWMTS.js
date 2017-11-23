L.TileLayer.ProjWMTS = L.TileLayer.extend({
    defaultWMTSParams: {
        // @option service: String = 'WMTS'
        // Name of service query string parameter
        service: 'WMTS',
        // @option request: String = 'GetTile'
        // Name of request query string parameter
        request: 'GetTile',
        // @option version: String = '1.0.0'
        // WMTS version passed as query string parameter
        version: '1.0.0',
        layer: '',
        style: '',
        // @option tileMatrixSet: String = ''
        // **(requred)**  Name of tile matrix set from WMTS
        tileMatrixSet: '',
        // @option format: String = 'image/jpeg'
        // format of WMTS tiles
        format: 'image/jpeg'
    },

    options:{
        // @option crs: L.Proj.CRS = null
        // **(requred)**  CRS definition that is the same as in WMTS:
        //      var crs = new L.Proj.CRS(
		//	        "EPSG:2180",
		//	        "+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs",
        //	        {}
        //      );
        crs: null,
        // @option tileSize: Number = 512
        // Size of tile in WMTS service
        tileSize: 512,
        // @option skewPartSize: Number = 32
        // Size in pixel of subpart that every tile is divided into. 
        // All projection calculations are computed for that subPart. 
        // If subPart is smaller then there is more computation needed for each tile and it takes more time 
        skewPartSize: 32
    },

    initialize: function(url, options){
        this._url = url;
        var wmtsParams = L.extend({}, this.defaultWMTSParams);
        this._tileSize = options.tileSize || this.options.tileSize;

        for(var i in options){
            // all keys that are not TileLayer options go to WMST params
            if(!this.options.hasOwnProperty(i) && i !== 'matrixIds'){
                wmtsParams[i] = options[i];
            }
        }
        this.wmtsParams = wmtsParams;
        this.matrixIds = options.matrixIds;
        options = L.Util.setOptions(this, options);

        this.s_srs = new proj4.Proj("EPSG:2180");
        
        if(!this.options.crs){
            console.warn("CRS undefined")
            this.s_srs = new proj4.Proj(this.wmtsParams.tilematrixSet);
        }else{
            this.s_srs = new proj4.Proj(this.options.crs.code);
        }
        //this.t_srs = new proj4.Proj("EPSG:4326");
        this.t_srs = new proj4.Proj("EPSG:3857");
    },
    onAdd: function(map){
        this._crs = this.options.crs || map.options.crs;

        L.TileLayer.prototype.onAdd.call(this, map);
    },
    _getResolutionFromLevel:function(level){
        //https://www.supermap.com/EN/online/iServer%20Java%206R/mergedProjects/sl/G_MapAndLayer/L_ResolutionAndScale.html
        //https://msdn.microsoft.com/en-us/library/bb259689.aspx
        var equatorLength = 40075016.68557849;
        var tileSize = this.getTileSize();
        return equatorLength / (tileSize.x * Math.pow(2, level));
    },
    _getResolutionFromScale:function(scaleDenominator){
        var inch = 0.0254;
        var dpi = 90.71428571429;
        return scaleDenominator * (inch / dpi);
    },
    _getScaleDenominator:function(resolution){
        var inch = 0.0254;
        var dpi = 90.71428571429;
        return resolution * (dpi / inch);
    },
    _getTilesInfo:function(coords){
        var result = {};
        //proper calculation for whole earth
        var resolution = this._getResolutionFromLevel(coords.z);
        var scaleDenominator = this._getScaleDenominator(resolution);
        result.scaleIndex = Math.min(this._findNeareastScale(scaleDenominator), this.options.scales.length -1);

        var tileSize = this.options.tileSize;
        var nwPoint = coords.multiplyBy(tileSize);
        //+/-1 in order to be on the tile
        nwPoint.x += 1;
        nwPoint.y -= 1;
        var sePoint = nwPoint.add(new L.Point(tileSize, tileSize));
        var nePoint = nwPoint.add(new L.Point(tileSize, 0));
        var swPoint = nwPoint.add(new L.Point(0, tileSize));
        
        var nw = this._crs.project(this._map.unproject(nwPoint, coords.z));
        var se = this._crs.project(this._map.unproject(sePoint, coords.z));
        var ne = this._crs.project(this._map.unproject(nePoint, coords.z));
        var sw = this._crs.project(this._map.unproject(swPoint, coords.z));

        var X0 = this.wmtsParams.origin[1];
        var Y0 = this.wmtsParams.origin[0];
        var WMTSResolution = this._getResolutionFromScale(this.wmtsParams.scales[result.scaleIndex]);
        var WMTSTileLength = WMTSResolution * tileSize;
        var tilecolnw = Math.floor((Math.min(nw.x, sw.x) - X0) / WMTSTileLength);
        var tilerownw = Math.floor((Y0 - Math.max(nw.y, ne.y)) / WMTSTileLength);
        var tilecolse = Math.floor((Math.max(se.x, ne.x) - X0) / WMTSTileLength);
        var tilerowse = Math.floor((Y0 - Math.min(se.y, sw.y)) / WMTSTileLength);
        
        result.tiles = [];
        for(var x = tilecolnw;x<=tilecolse;x++){
            for(var y = tilerownw;y<=tilerowse;y++){
                if(this._checkTileExist(x,y)){
                    result.tiles.push([x,y]);
                }
            }
        }        
        result.size = {x: Math.abs(tilecolse - tilecolnw) + 1, 
                        y: Math.abs(tilerowse - tilerownw) + 1};
        result.originColRow = {x: tilecolnw, y: tilerownw};

        result.pixelSize = [WMTSResolution, WMTSResolution]; 
        result.shift = [tilecolnw * WMTSTileLength + X0, Y0 - tilerownw * WMTSTileLength];
        result.xyz = "" + coords.x + coords.y + coords.z;
        var bbox3857 = [this._map.options.crs.project(this._map.unproject(nwPoint, coords.z)),this._map.options.crs.project(this._map.unproject(sePoint, coords.z))];
        result.bbox3857PixelSize = [(bbox3857[1].x - bbox3857[0].x) / tileSize, (bbox3857[0].y - bbox3857[1].y) / tileSize]
        result.bbox3857Shift = [bbox3857[0].x, bbox3857[1].y];
        return result;
    },
    getTileUrl:function(tilesInfo, tileIndex){
        var urlParams = {
            'SERVICE': this.wmtsParams.service,
            'REQUEST': this.wmtsParams.request,
            'VERSION': this.wmtsParams.version,
            'LAYER': this.wmtsParams.layer,
            'STYLE': this.wmtsParams.style,
            'FORMAT': this.wmtsParams.format,
            'TILEMATRIXSET': this.wmtsParams.tilematrixSet,
            'TILEMATRIX': (this.wmtsParams.identifierPrefix  || (this.wmtsParams.tilematrixSet + ":")) + tilesInfo.scaleIndex,
            'TILEROW': tilesInfo.tiles[tileIndex][1],
            'TILECOL': tilesInfo.tiles[tileIndex][0]
        };
        return this._url + L.Util.getParamString(urlParams, this._url); 
    },
    _checkTileExist: function(x,y){
        return true;
    },
    createTile: function(coords ,done){
        var tilesInfo = this._getTilesInfo(coords);
        if(tilesInfo.tiles.length === 0){
            setTimeout(L.Util.bind(done, this, null, null), 0);
        }
        var tileSize = this.getTileSize();
        var masterTile = this._createCanvas(tilesInfo.size.x * tileSize.x, tilesInfo.size.y * tileSize.y);
        masterTile.tilesInfo = tilesInfo;
        masterTile._loadedParts = 0;
        masterTile._allParts = tilesInfo.tiles.length;
        var masterContext = masterTile.getContext('2d');
        masterContext.clearRect(0, 0, masterTile.width, masterTile.height);
        //this._drawDebugLines(masterContext);
        masterContext.rect(12,13,100,100);
        masterContext.stroke();

        for(var tileIndex in tilesInfo.tiles){
            var tile =tilesInfo.tiles[tileIndex];
            var img = document.createElement('img');
            img.masterTile = masterTile;
            img.masterContext = masterContext;
            img.tileOrigin = [tile[0] - tilesInfo.originColRow.x, tile[1] - tilesInfo.originColRow.y];
            L.DomEvent.on(img, 'load', L.Util.bind(this._tileOnLoad, this, done, img));
            L.DomEvent.on(img, 'error', L.Util.bind(this._tileOnLoad, this, done, img));
            if(this.options.crossOrigin){
                img.crossOrigin = '';
            }
            img.alt = '';
            img.setAttribute('role', 'presentation');
            img.src = this.getTileUrl(tilesInfo, tileIndex);
            
        }
      
        var finalCanvas = this._createCanvas(tileSize.x, tileSize.y);
        masterTile._finalCanvas = finalCanvas;
        return finalCanvas;
    },
    _findNeareastScale: function(scale){
        var result = 0;
        var min = Number.MAX_SAFE_INTEGER;
        for(var i=this.wmtsParams.scales.length-1;i>=0;i--){
            var currDiff = Math.abs(this.wmtsParams.scales[i] - scale);
            if(currDiff < min && this.wmtsParams.scales[i] > scale){
                min = currDiff;
                result = i;
            }
        }
        return result;
    },

    _tileOnLoad: function(done, tile){
        if(tile.projected){
            return;
        }
        tile.projected = true;
        this._copyImageToCanvas(tile);
        this._processTile(tile, done);
    },
    _tileOnError:function(done, tile){
        this._processTile(tile, done);
    },
    _processTile:function(tile, done){
        tile.masterTile._loadedParts++;
        if(tile.masterTile._loadedParts >= tile.masterTile._allParts){

            //console.time('c' + tile.masterTile.tilesInfo.xyz);
            this._warpBySkew(tile.masterTile, tile.masterTile._finalCanvas);
            //this._warpPixelByPixel(tile.masterTile, tile.masterTile._finalCanvas);
            //console.timeEnd('c' + tile.masterTile.tilesInfo.xyz);
    
            // For https://github.com/Leaflet/Leaflet/issues/3332
            if (L.Browser.ielt9) {
                setTimeout(L.Util.bind(done, this, null, tile), 0);
            }else{
                done(null, tile);
            }
        }
    },
    _copyImageToCanvas: function(img){
        if(!img || img.naturalWidth === 0 || img.naturalHeight === 0)
            return;
        var w = img.naturalWidth,
            h = img.naturalHeight;
        var context = img.masterContext;
        context.clearRect(img.tileOrigin[0] * w, img.tileOrigin[1] * h, w, h);
        context.drawImage(img, img.tileOrigin[0] * w, img.tileOrigin[1] * h);
    },
    /**
     * @param {number} width
     * @param {number} height
     * @returns {HTMLCanvas}
     */
    _createCanvas: function(width, height){
        var result = document.createElement("canvas");
        result.style.width = width + "px";
        result.style.height = height + "px";
        result.width = width;
        result.height = height;
        return result;
    },
    _drawDebugLines: function(context){
        context.beginPath();
        for(var x=0;x<context.canvas.width;x+=20){
            context.moveTo(x, 0)
            context.lineTo(x, context.canvas.height);
        }
        for(var y=0;y<context.canvas.height;y+=20){
            context.moveTo(0, y)
            context.lineTo(context.canvas.width, y);
        }
        context.stroke();
    },
    _warpBySkew:function(masterTile, finalCanvas){
        var partSize = this.options.skewPartSize;
        var tileSize = this.getTileSize();
        var finalCanvasContext = finalCanvas.getContext("2d");
        for(var x=-partSize;x<=tileSize.x;x+=partSize-1){
            for(var y=-partSize;y<=tileSize.y;y+=partSize-1){
  
              var out1 = this._transProj4js(x, y, masterTile.tilesInfo);
              var out2 = this._transProj4js(x+partSize, y, masterTile.tilesInfo);
              var out3 = this._transProj4js(x, y+partSize, masterTile.tilesInfo);
              //hscale, hskew, vskew, vscale, hmove, vmove
              finalCanvasContext.setTransform(1,-(out2[1] - out1[1]) / partSize,-(out3[0] - out1[0]) / partSize,1,x+partSize/2,y+partSize/2);
              //img,sx,sy,swidth,sheight,x,y,width,height
              finalCanvasContext.drawImage(masterTile, 
                                            out1[0], out1[1], out2[0] - out1[0], out3[1]-out1[1],
                                            -partSize/2, -partSize/2, partSize, partSize);
            }
        }
    },
    _warpPixelByPixel:function(masterTile, finalCanvas){
        var finalCanvasContext = finalCanvas.getContext("2d");
        var masterContext = masterTile.getContext("2d");
        finalCanvasContext.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
        var masterImageData = masterContext.getImageData( 0, 0, masterTile.width, masterTile.height );
        var finalImageData = finalCanvasContext.getImageData( 0, 0, finalCanvas.width, finalCanvas.height);

        for (var x = 0; x < finalImageData.width; x++)
            for (var y = 0; y < finalImageData.height; y++)
            {
            var offset = (y * finalImageData.width + x) * 4;
            var out = this._transProj4js(x, y, masterTile.tilesInfo);
            //var out = [x,y];
            if(out[0] < 0 || out[0] > masterImageData.width || out[1] < 0 || out[1] > masterImageData.height)
                continue;            
            var s_offset = ( parseInt( out[1] ) * masterImageData.width + parseInt( out[0] ) ) * 4;
            if (offset){
                finalImageData.data[offset+0] = masterImageData.data[s_offset+0];
                finalImageData.data[offset+1] = masterImageData.data[s_offset+1];
                finalImageData.data[offset+2] = masterImageData.data[s_offset+2];
                finalImageData.data[offset+3] = masterImageData.data[s_offset+3];
            }
        }
        finalCanvasContext.putImageData(finalImageData, 0, 0);
    },

	_transProj4js:(function () {
        var p = new proj4.toPoint([0,0]);
        return function(x,y, tilesInfo){        
            p.x = x*tilesInfo.bbox3857PixelSize[0] + tilesInfo.bbox3857Shift[0];
            p.y = (this.options.tileSize-y)* tilesInfo.bbox3857PixelSize[1]+ tilesInfo.bbox3857Shift[1];
            proj4.transform(this.t_srs, this.s_srs, p);
            return [((p.x -  tilesInfo.shift[0])/ tilesInfo.pixelSize[0]), (( tilesInfo.shift[1]- p.y)/ tilesInfo.pixelSize[1])];
        }
	})(),

});

// @factory L.tileLayer.projwmts(baseUrl: String, options: TileLayer.WMTS options)
// Instantiates a WMTS tile layer object given a base URL of the WMTS service and a WMTS parameters/options object.
L.tileLayer.projwmts = function(url, options) {
	return new L.TileLayer.ProjWMTS(url, options);
}