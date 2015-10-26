/// <reference path="typings/d3/d3.d.ts"/>
/// <reference path="lib/jqdap.d.ts"/>

module squid {
export class DataManager {
  static $inject = ['$q'];
  public selectedDate : Date;
  public cpueDateFrom : Date;
  public cpueDateTo : Date;
  public opendapEndpoint : string;
  public CPUEPoints : any[];
  public username: string;
  public password: string;
  private dataCache = {};
  private dimensions;
  private axes;

  constructor(private $q) {
  }

  loadMOVE(variableName : string, depthIndex : number, region : any) {
    var deferred = this.$q.defer();
    var key = this.key(variableName, this.selectedDate, depthIndex);
    if (this.dataCache[key]) {
      deferred.resolve(this.dataCache[key]);
    } else {
      var v = variableName.toLowerCase();
      var dateIndex = this.dateIndex(this.selectedDate);
      var d = depthIndex;
      var latRegion = this.region('lat', region.latFrom, region.latTo);
      var lonRegion = this.region('lon', region.lonFrom, region.lonTo);
      var lat = latRegion[0] + ':' + latRegion[1];
      var lon = lonRegion[0] + ':' + lonRegion[1];
      var query = v + '[' + dateIndex + '][' + d + '][' + lat + '][' + lon + ']';
      if (/fcst\d{4}/.test(this.opendapEndpoint)) {
        switch (v) {
          case 'u':
          case 'v':
          case 't':
          case 's':
          case 'hm':
            var file = 'fcst';
            break;
          default:
            var file = v;
        }
      } else {
        var file = v;
      }
      var dataUrl = this.opendapEndpoint + file + '.dods?' + query;
      jqdap.loadData(dataUrl, this.jqdapOptions())
        .then(data => {
          deferred.resolve(this.dataCache[key] = data);
        });
    }
    return deferred.promise;
  }

  loadCPUE(file) {
    var deferred = this.$q.defer();

    return deferred.promise;
  }

  getCPUE() {
    return this.CPUEPoints.filter(d => {
      return this.cpueDateFrom <= d.date && d.date <= this.cpueDateTo;
    });
  }

  getExpectedCPUE() {
    return this.CPUEPoints.filter(d => {
      return d.date.getTime() == this.selectedDate.getTime();
    });
  }

  initialize(CPUEPoints, opendapEndpoint : string) {
    return this.loadData(this.opendapEndpoint + 'w.dods?lat,lon,lev,time')
      .then(data => {
        this.axes = {
          lon: data[3],
          lat: data[2],
          lev: data[1],
          time: data[0],
        };
      });
  }

  initialized() : boolean {
    return this.CPUEPoints !== undefined;
  }

  private key(variableName : string, date : Date, depthIndex : number) : string {
    return this.dateIndex(date) + variableName + depthIndex;
  }

  private loadDataset(url : string) {
    var deferred = this.$q.defer();
    jqdap.loadDataset(url, this.jqdapOptions())
      .then(result => {
        deferred.resolve(result);
      });
    return deferred.promise;
  }

  private loadData(url : string) {
    var deferred = this.$q.defer();
    jqdap.loadData(url, this.jqdapOptions())
      .then(result => {
        deferred.resolve(result);
      });
    return deferred.promise;
  }

  private region(name : string, min : number, max : number) : any {
    var axis = this.axes[name];
    var x0 = axis.length - 1;
    for (var i = 0; i < axis.length; ++i) {
      if (min < axis[i]) {
        x0 = Math.max(0, i - 1);
        break;
      }
    }
    var x1 = 0;
    for (var i = axis.length - 1; i > 0; --i) {
      if (axis[i] < max) {
        x1 = Math.min(axis.length - 1, i + 1);
        break;
      }
    }

    return [x0, x1];
  }

  private dateIndex(date : Date) : number {
    var axis = this.axes.time;
    var baseDate = new Date(1970, 0, 1);
    var x = Math.floor((date.getTime() - baseDate.getTime()) / 86400000) + 719164;
    return Math.min(d3.bisectLeft(axis, x), axis.length - 1);
  }

  private jqdapOptions(): jqdap.AjaxOptions {
    if (this.username || this.password) {
      return {
        withCredentials: true,
        username: this.username,
        password: this.password,
      };
    } else {
      return {};
    }
  }
}
}
