(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.geomagnetism = factory());
})(this, (function () { 'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	function getCjsExportFromNamespace (n) {
		return n && n['default'] || n;
	}

	var GeodeticCoord$1 = geodetic;

	var cartesian = CartesianCoord;

	function CartesianCoord(options){
		this.x = options.x;
		this.y = options.y;
		this.z = options.z; 
	}

	CartesianCoord.prototype.toGeodetic = function(ellipsoid){
		var modified_b = this.z < 0 ? -ellipsoid.b : ellipsoid.b;
		var x = this.x; 
		var y = this.y;
		var z = this.z;
		var r = Math.sqr(x*x + y*y);
		var e = (modified_b*z - (ellipsoid.a*ellipsoid.a - modified_b*modified_b)) / (ellipsoid.a*r);
		var f = (modified_b*z + (ellipsoid.a*ellipsoid.a - modified_b*modified_b)) / (ellipsoid.a*r);
		var p = (4/3) * (e*f+1);
		var q = 2 * (e*e + f*f);
		var d = p*p*p + q*q;
		var v; 
		if(d > 0) {
			v = Math.pow(Math.sqrt(d) - q, 1/3) - Math.pow(Math.sqrt(d) + q, 1/3);		
		} else {
			v = 2 * Math.sqrt(-p) * Math.cos(Math.acos(q / (p * Math.sqrt(-p)) ) / 3);
		}
		if(v*v < Math.abs(p)) {
			v = -(v*v*v + 2*q) / 3*p;
		}
		var g = (Math.sqrt(e*e + v) + e) / 2;
		var t = Math.sqrt(g*g + (f - v*g)/(2*g - e)) - g;
		var rlat = Math.atan( (ellipsoid.a*(1 - t*t)) / (2*modified_b*t) );
		var zlong = Math.atan2(y, x);
		if(zlong < 0) zlong += 2*Math.PI;
		var height_above_ellipsoid = (r - ellipsoid.a*t) * Math.cos(rlat) + (z - modified_b) * Math.sin(rlat);
		var lambda = zlong * Math.PI/180;
		if(lambda > 180) lambda -= 360;

		return new GeodeticCoord$1({
			lambda: lambda,
			phi: rlat * Math.PI/180,
			height_above_ellipsoid: height_above_ellipsoid,
			ellipsoid: ellipsoid
		});
	};

	var legendre = LegendreFunction;

	function LegendreFunction(coord_spherical, n_max){
		var sin_phi = Math.sin(Math.PI/180 * coord_spherical.phig);
		var result;
		if(n_max <= 16 || (1 - Math.abs(sin_phi)) < 1e-10){
			result = PcupLow(sin_phi, n_max);
		} else {
			result = PcupHigh(sin_phi, n_max);
		}
		this.pcup = result.pcup;
		this.dpcup = result.dpcup;
	}

	function PcupLow(x, n_max){
		var k, z, n, m, i, i1, i2;
		var schmidt_quasi_norm = [1.0];
		var pcup = [1.0];
		var dpcup = [0.0];

		z = Math.sqrt((1-x)*(1+x));


		for(n = 1; n <= n_max; n++) {
			for(m = 0; m <= n; m++) {
				i = n*(n+1)/2 + m;
				if(n == m){
					i1 = (n-1)*n/2 + m - 1;
					pcup[i] = z*pcup[i1];
					dpcup[i] = z*dpcup[i1] + x*pcup[i1];
				} else if (n == 1 && m == 0) {
					i1 = (n-1)*n/2 + m;
					pcup[i] = x*pcup[i1];
					dpcup[i] = x*dpcup[i1] - z*pcup[i1];
				} else if (n > 1 && n != m) {
					i1 = (n-2)*(n-1)/2 + m;
					i2 = (n-1)*n/2 + m;
					if(m > n - 2){
						pcup[i] = x*pcup[i2];
						dpcup[i] = x*dpcup[i2] - z*pcup[i2];
					} else {
						k = ((n-1)*(n-1) - m*m) / ((2*n-1)*(2*n-3));
						pcup[i] = x*pcup[i2] - k*pcup[i1];
						dpcup[i] = x*dpcup[i2] - z*pcup[i2] - k*dpcup[i1];
					}
				}
			}
		}
		
		for(n = 1; n <= n_max; n++) {
			i = n*(n+1)/2;
			i1 = (n-1)*n/2;
			schmidt_quasi_norm[i] = schmidt_quasi_norm[i1] * (2*n-1) / n;
			for(m = 1; m <= n; m++){
				i = n*(n+1)/2 + m;
				i1 = n*(n+1)/2 + m - 1;
				schmidt_quasi_norm[i] = schmidt_quasi_norm[i1] * Math.sqrt(((n - m + 1) * (m == 1 ? 2 : 1)) / (n + m));
			}	
		}

		for(n = 1; n <= n_max; n++) {
			for(m = 0; m <= n; m++) {
				i = n*(n+1)/2+m;
				pcup[i] *= schmidt_quasi_norm[i];
				dpcup[i] *= -schmidt_quasi_norm[i];
			}
		}

		return {
			pcup: pcup,
			dpcup: dpcup
		};
	}

	function PcupHigh(x, n_max){
		if(Math.abs(x) == 1.0){
			throw new Error("Error in PcupHigh: derivative cannot be calculated at poles");
		}

		var n, m, k;
		var f1 = [];
		var f2 = [];
		var pre_sqr = [];
		var scalef = 1.0e-280;

		for(n = 0; n <= 2*n_max + 1; ++n){
			pre_sqr[n] = Math.sqrt(n);
		}

		k = 2;
		for(n = 0; n <= n_max; n++){
			k++;
			f1[k] = (2*n - 1) / n;
			f2[k] = (n - 1) / n;
			for(m = 1; m <= n - 2; m++){
				k++;
				f1[k] = (2*n - 1) / pre_sqr[n+m] / pre_sqr[n-m];
				f2[k] = pre_sqr[n-m-1] * pre_sqr[n+m-1] / pre_sqr[n+m] / pre_sqr[n-m];
			}
			k += 2;
		}

		var z = Math.sqrt((1-x)*(1+x));
		var plm;
		var pm1 = x;
		var pm2 = 1;
		var pcup = [1.0, pm1];
		var dpcup = [0.0, z];
		if(n_max == 0){
			throw new Error("Error in PcupHigh: n_max must be greater than 0");
		}
		
		k = 1;
		for(n = 2; n <= n_max; n++)
		{
			k = k + n;
			plm = f1[k] * x * pm1 - f2[k] * pm2;
			pcup[k] = plm;
			dpcup[k] = n * (pm1 - x * plm) / z;
			pm2 = pm1;
			pm1 = plm;
		}

		var pmm = pre_sqr[2] * scalef;
		var rescalem = 1/scalef;
		var kstart = 0;

		for(var m = 1; m <= n_max - 1; ++m){
			rescalem *= z;

			//calculate pcup(m,m)
			kstart = kstart + m + 1;
			pmm = pmm * pre_sqr[2*m+1] / pre_sqr[2*m];
			pcup[kstart] = pmm * rescalem / pre_sqr[2*m+1];
			dpcup[kstart] = -( m*x*pcup[kstart] /z );
			pm2 = pmm / pre_sqr[2*m + 1];

			//calculate pcup(m+1,m)
			k = kstart + m + 1;
			pm1 = x * pre_sqr[2*m+1] * pm2;
			pcup[k] = pm1*rescalem;
			dpcup[k] = (pm2*rescalem *pre_sqr[2*m+1] - x*(m+1)*pcup[k]) / z;

			//calculate pcup(n,m)
			for(n = m + 2; n <= n_max; ++n){
				k = k + n;
				plm = x*f1[k]*pm1 - f2[k]*pm2;
				pcup[k] = plm*rescalem;
				dpcup[k] = (pre_sqr[n+m]*pre_sqr[n-m]*pm1*rescalem - n*x*pcup[k]) / z;
				pm2 = pm1;
				pm1 = plm;
			}
		}

		//calculate pcup(n_max,n_max)
		rescalem = rescalem*z;
		kstart = kstart + m + 1;
		pmm = pmm / pre_sqr[2*n_max];
		pcup[kstart] = pmm * rescalem;
		dpcup[kstart] = -n_max * x * pcup[kstart] / z;

		return {
			pcup: pcup,
			dpcup: dpcup
		};
	}

	var spherical = SphericalCoord;

	function SphericalCoord(options){
		this.lambda = options.lambda; // longitude
		this.phig = options.phig; // geocentric latitude
		this.r = options.r; // distance from center of ellipsoid
	}

	SphericalCoord.prototype.toCartesian = function(){
		var radphi = this.phig * Math.PI/180;
		var radlambda = this.lambda * Math.PI/180;
		return new cartesian({
			x: this.r * cos(radphi) * cos(radlambda),
			y: this.r * cos(radphi) * sin(radlambda),
			z: this.r * sin(radphi)
		});
	};

	SphericalCoord.prototype.toGeodetic = function(ellipsoid){
		return this.toCartesian().toGeodetic(ellipsoid);
	};

	SphericalCoord.prototype.getHarmonicVariables = function(ellipsoid, n_max){
		var m, n;
		var cos_lambda = Math.cos(Math.PI/180 * this.lambda);
		var sin_lambda = Math.sin(Math.PI/180 * this.lambda);

		var cos_mlambda = [1.0, cos_lambda];
		var sin_mlambda = [0.0, sin_lambda];
		var relative_radius_power = [
			(ellipsoid.re/this.r) * (ellipsoid.re/this.r)
		];

		for(n = 1; n <= n_max; n++){
			relative_radius_power[n] = relative_radius_power[n-1] * (ellipsoid.re/this.r);
		}
		for(m = 2; m <= n_max; m++){
			cos_mlambda[m] = cos_mlambda[m-1]*cos_lambda - sin_mlambda[m-1]*sin_lambda;
			sin_mlambda[m] = cos_mlambda[m-1]*sin_lambda + sin_mlambda[m-1]*cos_lambda;
		}

		return {
			relative_radius_power: relative_radius_power,
			cos_mlambda: cos_mlambda,
			sin_mlambda: sin_mlambda
		};
	};

	SphericalCoord.prototype.getLegendreFunction = function(n_max) {
		return new legendre(this, n_max);
	};

	var ellipsoid = Ellipsoid;

	function Ellipsoid(options) {
	    options = options || {
	        a: 6378.137,
	        b: 6356.7523142,
	        fla: 1 / 298.257223563,
	        re: 6371.2
	    };

	    this.a = options.a; // semi-major axis
	    this.b = options.b; // semi-minor axis
	    this.fla = options.fla; // flattening
	    this.re = options.re; // mean radius
	    this.eps = Math.sqrt(1-(this.b*this.b)/(this.a*this.a)); // first eccentricity
	    this.epssq = this.eps*this.eps; // first eccentricity squared
	}

	var geodetic = GeodeticCoord;

	function GeodeticCoord(options){
		this.options = options;
		this.lambda = options.lambda || options.lon; // longitude
		this.phi = options.phi || options.lat; // geodetic latitude
		this.height_above_ellipsoid = options.height_above_ellipsoid || 0;
		this.ellipsoid = options.ellipsoid || new ellipsoid();
	}

	GeodeticCoord.prototype.toSpherical = function() {
		var ellipsoid = this.ellipsoid;
		var coslat = Math.cos(this.phi*Math.PI/180);
		var sinlat = Math.sin(this.phi*Math.PI/180);
		var rc = ellipsoid.a / Math.sqrt(1 - ellipsoid.epssq * sinlat * sinlat);
		var xp = (rc + this.height_above_ellipsoid) * coslat;
		var zp = (rc * (1 - ellipsoid.epssq) + this.height_above_ellipsoid) * sinlat;
		var r = Math.sqrt(xp*xp + zp*zp);
		return new spherical({
			r: r,
			phig: 180/Math.PI*Math.asin(zp / r),
			lambda: this.lambda
		});
	};

	GeodeticCoord.prototype.clone = function(){
		return new GeodeticCoord(this.options);
	};

	var magnetic_elements = MagneticElements;

	function MagneticElements(options){
		this.x = options.x;
		this.y = options.y;
		this.z = options.z;
		this.h = options.h;
		this.f = options.f;
		this.incl = options.incl;
		this.decl = options.decl;
		this.gv = options.gv;
		this.xdot = options.xdot;
		this.ydot = options.ydot;
		this.zdot = options.zdot;
		this.hdot = options.hdot;
		this.fdot = options.fdot;
		this.incldot = options.incldot;
		this.decldot = options.decldot;
		this.gvdot = options.gvdot;
	}

	MagneticElements.prototype.clone = function(){
		return new MagneticElements(this);
	};

	MagneticElements.prototype.scale = function(factor){
		return new MagneticElements({
			x : this.x * factor,
			y : this.y * factor,
			z : this.z * factor,
			h : this.h * factor,
			f : this.f * factor,
			incl : this.incl * factor,
			decl : this.decl * factor,
			gv : this.gv * factor,
			xdot : this.xdot * factor,
			ydot : this.ydot * factor,
			zdot : this.zdot * factor,
			hdot : this.hdot * factor,
			fdot : this.fdot * factor,
			incldot : this.incldot * factor,
			decldot : this.decldot * factor,
			gvdot : this.gvdot * factor
		});
	};

	MagneticElements.prototype.subtract = function(subtrahend){
		return new MagneticElements({
			x : this.x - subtrahend.x,
			y : this.y - subtrahend.y,
			z : this.z - subtrahend.z,
			h : this.h - subtrahend.h,
			f : this.f - subtrahend.f,
			incl : this.incl - subtrahend.incl,
			decl : this.decl - subtrahend.decl,
			gv : this.gv - subtrahend.gv,
			xdot : this.xdot - subtrahend.xdot,
			ydot : this.ydot - subtrahend.ydot,
			zdot : this.zdot - subtrahend.zdot,
			hdot : this.hdot - subtrahend.hdot,
			fdot : this.fdot - subtrahend.fdot,
			incldot : this.incldot - subtrahend.incldot,
			decldot : this.decldot - subtrahend.decldot,
			gvdot : this.gvdot - subtrahend.gvdot
		});
	};

	MagneticElements.fromGeoMagneticVector = function(magnetic_vector){
		var bx = magnetic_vector.bx;
		var by = magnetic_vector.by;
		var bz = magnetic_vector.bz;
		var h = Math.sqrt(bx*bx + by*by);
		return new MagneticElements({
			x: bx,
			y: by,
			z: bz,
			h: h,
			f: Math.sqrt(h*h + bz*bz),
			decl: 180/Math.PI * Math.atan2(by, bx),
			incl: 180/Math.PI * Math.atan2(bz, h)
		});
	};

	MagneticElements.fromSecularVariationVector = function(magnetic_variation){
		var bx = magnetic_variation.bx;
		var by = magnetic_variation.by;
		var bz = magnetic_variation.bz;
		return new MagneticElements({
			xdot: bx,
			ydot: by,
			zdot: bz,
			hdot: (this.x*bx + this.y*by) / this.h,
			fdot: (this.x*bx + this.y*by + this.z*bz) / this.f,
			decldot: 180/Math.PI * (this.x*this.ydot - this.y*this.xdot) / (this.h*this.h),
			incldot: 180/Math.PI * (this.h*this.zdot - this.z*this.hdot) / (this.f*this.f),
			gvdot: this.decldot
		});
	};

	var magnetic_vector = MagneticVector;

	function MagneticVector(options){
		this.bx = options.bx;
		this.by = options.by;
		this.bz = options.bz;
	}

	MagneticVector.prototype.rotate = function(coord_spherical, coord_geodetic) {
		var psi = Math.PI/180 * (coord_spherical.phig - coord_geodetic.phi);
		return new MagneticVector({
			bz: this.bx*Math.sin(psi) + this.bz*Math.cos(psi),
			bx: this.bx*Math.cos(psi) - this.bz*Math.sin(psi),
			by: this.by
		});
	};

	var model = Model;

	function Model(options){
		this.epoch = options.epoch;
		this.start_date = new Date(options.start_date);
		this.end_date = new Date(options.end_date);
		this.name = options.name || "";
		this.main_field_coeff_g = options.main_field_coeff_g || [0];
		this.main_field_coeff_h = options.main_field_coeff_h || [0];
		this.secular_var_coeff_g = options.secular_var_coeff_g || [0];
		this.secular_var_coeff_h = options.secular_var_coeff_h || [0];
		this.n_max = options.n_max || 0;
		this.n_max_sec_var = options.n_max_sec_var || 0;
		this.num_terms = this.n_max*(this.n_max+1)/2 + this.n_max;
	}

	Model.prototype.getTimedModel = function(date, allowOutOfBoundsModel = false){
		var year_int = date.getUTCFullYear();
		var fractional_year = (date.valueOf() - Date.UTC(year_int)) / (1000*3600*24*365);
		var year = year_int + fractional_year;
		var dyear = year - this.epoch;

		if(date < this.start_date || date > this.end_date){
			if(allowOutOfBoundsModel) {
				console.error("Model is only valid from "+this.start_date.toDateString()+" to "+this.end_date.toDateString());
			} else {
				throw new Error("Model is only valid from "+this.start_date.toDateString()+" to "+this.end_date.toDateString());
			}
		}

		var model = new Model({
			epoch: this.epoch,
			n_max: this.n_max,
			n_max_sec_var: this.n_max_sec_var,
			name: this.name,
			start_date: this.start_date,
			end_date: this.end_date,
		});
		var a = model.n_max_sec_var;
		var b = a*(a + 1)/2 + a;
		for(var n = 1; n <= this.n_max; n++){
			for(var m = 0; m <= n; m++){
				var i = n * (n + 1)/2 + m;
				var hnm = this.main_field_coeff_h[i];
				var gnm = this.main_field_coeff_g[i];
				var dhnm = this.secular_var_coeff_h[i];
				var dgnm = this.secular_var_coeff_g[i];
				if(i <= b){
					model.main_field_coeff_h[i] = hnm + dyear*dhnm;
					model.main_field_coeff_g[i] = gnm + dyear*dgnm;
					model.secular_var_coeff_h[i] = dhnm;
					model.secular_var_coeff_g[i] = dgnm;
				} else {
					model.main_field_coeff_h[i] = hnm;
					model.main_field_coeff_g[i] = gnm;
				}
			}
		}
		return model;
	};

	Model.prototype.getSummation = function(legendre, sph_variables, coord_spherical){
		var bx = 0;
		var by = 0;
		var bz = 0;
		var n, m, i, k;
		var relative_radius_power = sph_variables.relative_radius_power;
		var cos_mlambda = sph_variables.cos_mlambda;
		var sin_mlambda = sph_variables.sin_mlambda;
		var g = this.main_field_coeff_g;
		var h = this.main_field_coeff_h;

		for(n = 1; n <= this.n_max; n++){
			for(m = 0; m <= n; m++){
				i = n*(n+1)/2 + m;
				bz -= relative_radius_power[n] *
					(g[i]*cos_mlambda[m] + h[i]*sin_mlambda[m]) *
					(n+1) * legendre.pcup[i];
				by += relative_radius_power[n] *
					(g[i]*sin_mlambda[m] - h[i]*cos_mlambda[m]) *
					(m) * legendre.pcup[i];
				bx -= relative_radius_power[n] *
					(g[i]*cos_mlambda[m] + h[i]*sin_mlambda[m]) *
					legendre.dpcup[i];
			}
		}
		var cos_phi = Math.cos(Math.PI/180 * coord_spherical.phig);
		if(Math.abs(cos_phi) > 1e-10){
			by = by / cos_phi;
		} else {
			//special calculation around poles
			by = 0;
			var schmidt_quasi_norm1 = 1.0, schmidt_quasi_norm2, schmidt_quasi_norm3;
			var pcup_s = [1];
			var sin_phi = Math.sin(Math.PI/180 * coord_spherical.phig);

			for(n = 1; n <= this.n_max; n++){
				i = n*(n+1)/2 + 1;
				schmidt_quasi_norm2 = schmidt_quasi_norm1 * (2*n-1) / n;
				schmidt_quasi_norm3 = schmidt_quasi_norm2 * Math.sqrt(2*n/(n+1));
				schmidt_quasi_norm1 = schmidt_quasi_norm2;
				if(n == 1){
					pcup_s[n] = pcup_s[n-1];
				} else {
					k = ((n-1)*(n-1) - 1) / ((2*n-1)*(2*n-3));
					pcup_s[n] = sin_phi * pcup_s[n-1] - k*pcup_s[n-2];
				}
				by += relative_radius_power[n] *
					(g[i]*sin_mlambda[1] - h[i]*cos_mlambda[1]) *
					pcup_s[n] * schmidt_quasi_norm3;
			}
		}
		return new magnetic_vector({
			bx: bx, by: by, bz: bz
		});
	};

	Model.prototype.point = function(coords) {
		// Extract altitude if provided, otherwise default to 0
		var altitude = (coords.length > 2 && typeof coords[2] === 'number') ? coords[2] : 0;

		var coord_geodetic = new GeodeticCoord$1({
			lat: coords[0],
			lon: coords[1],
			height_above_ellipsoid: altitude
		});
		var coord_spherical = coord_geodetic.toSpherical();

		var legendre = coord_spherical.getLegendreFunction(this.n_max);
		var harmonic_variables = coord_spherical.getHarmonicVariables(coord_geodetic.ellipsoid, this.n_max);

		var magnetic_vector_sph = this.getSummation(legendre, harmonic_variables, coord_spherical);
		var magnetic_vector_geo = magnetic_vector_sph.rotate(coord_spherical, coord_geodetic);

		return magnetic_elements.fromGeoMagneticVector(magnetic_vector_geo);
	};

	var main_field_coeff_g$3 = [
		0,
		-29351.8,
		-1410.8,
		-2556.6,
		2951.1,
		1649.3,
		1361,
		-2404.1,
		1243.8,
		453.6,
		895,
		799.5,
		55.7,
		-281.1,
		12.1,
		-233.2,
		368.9,
		187.2,
		-138.7,
		-142,
		20.9,
		64.4,
		63.8,
		76.9,
		-115.7,
		-40.9,
		14.9,
		-60.7,
		79.5,
		-77,
		-8.8,
		59.3,
		15.8,
		2.5,
		-11.1,
		14.2,
		23.2,
		10.8,
		-17.5,
		2,
		-21.7,
		16.9,
		15,
		-16.8,
		0.9,
		4.6,
		7.8,
		3,
		-0.2,
		-2.5,
		-13.1,
		2.4,
		8.6,
		-8.7,
		-12.9,
		-1.3,
		-6.4,
		0.2,
		2,
		-1,
		-0.6,
		-0.9,
		1.5,
		0.9,
		-2.7,
		-3.9,
		2.9,
		-1.5,
		-2.5,
		2.4,
		-0.6,
		-0.1,
		-0.6,
		-0.1,
		1.1,
		-1,
		-0.2,
		2.6,
		-2,
		-0.2,
		0.3,
		1.2,
		-1.3,
		0.6,
		0.6,
		0.5,
		-0.1,
		-0.4,
		-0.2,
		-1.3,
		-0.7
	];
	var main_field_coeff_h$3 = [
		0,
		0,
		4545.4,
		0,
		-3133.6,
		-815.1,
		0,
		-56.6,
		237.5,
		-549.5,
		0,
		278.6,
		-133.9,
		212,
		-375.6,
		0,
		45.4,
		220.2,
		-122.9,
		43,
		106.1,
		0,
		-18.4,
		16.8,
		48.8,
		-59.8,
		10.9,
		72.7,
		0,
		-48.9,
		-14.4,
		-1,
		23.4,
		-7.4,
		-25.1,
		-2.3,
		0,
		7.1,
		-12.6,
		11.4,
		-9.7,
		12.7,
		0.7,
		-5.2,
		3.9,
		0,
		-24.8,
		12.2,
		8.3,
		-3.3,
		-5.2,
		7.2,
		-0.6,
		0.8,
		10,
		0,
		3.3,
		0,
		2.4,
		5.3,
		-9.1,
		0.4,
		-4.2,
		-3.8,
		0.9,
		-9.1,
		0,
		0,
		2.9,
		-0.6,
		0.2,
		0.5,
		-0.3,
		-1.2,
		-1.7,
		-2.9,
		-1.8,
		-2.3,
		0,
		-1.3,
		0.7,
		1,
		-1.4,
		0,
		0.6,
		-0.1,
		0.8,
		0.1,
		-1,
		0.1,
		0.2
	];
	var secular_var_coeff_g$3 = [
		0,
		12,
		9.7,
		-11.6,
		-5.2,
		-8,
		-1.3,
		-4.2,
		0.4,
		-15.6,
		-1.6,
		-2.4,
		-6,
		5.6,
		-7,
		0.6,
		1.4,
		0,
		0.6,
		2.2,
		0.9,
		-0.2,
		-0.4,
		0.9,
		1.2,
		-0.9,
		0.3,
		0.9,
		0,
		-0.1,
		-0.1,
		0.5,
		-0.1,
		-0.8,
		-0.8,
		0.8,
		-0.1,
		0.2,
		0,
		0.5,
		-0.1,
		0.3,
		0.2,
		0,
		0.2,
		0,
		-0.1,
		0.1,
		0.3,
		-0.3,
		0,
		0.3,
		-0.1,
		0.1,
		-0.1,
		0.1,
		0,
		0.1,
		0.1,
		0,
		-0.3,
		0,
		-0.1,
		-0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-0.1,
		0,
		0,
		-0.1,
		-0.1,
		-0.1,
		-0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		0.1,
		0,
		0,
		0,
		-0.1,
		0,
		-0.1
	];
	var secular_var_coeff_h$3 = [
		0,
		0,
		-21.5,
		0,
		-27.7,
		-12.1,
		0,
		4,
		-0.3,
		-4.1,
		0,
		-1.1,
		4.1,
		1.6,
		-4.4,
		0,
		-0.5,
		2.2,
		0.4,
		1.7,
		1.9,
		0,
		0.3,
		-1.6,
		-0.4,
		0.9,
		0.7,
		0.9,
		0,
		0.6,
		0.5,
		-0.8,
		0,
		-1,
		0.6,
		-0.2,
		0,
		-0.2,
		0.5,
		-0.4,
		0.4,
		-0.5,
		-0.6,
		0.3,
		0.2,
		0,
		-0.3,
		0.3,
		-0.3,
		0.3,
		0.2,
		-0.1,
		-0.2,
		0.4,
		0.1,
		0,
		0,
		0,
		-0.2,
		0.1,
		-0.1,
		0.1,
		0,
		-0.1,
		0.2,
		0,
		0,
		0,
		0.1,
		0,
		0.1,
		0,
		0,
		0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-0.1,
		0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-0.1
	];
	var n_max$3 = 12;
	var n_max_sec_var$3 = 12;
	var epoch$3 = 2025;
	var name$3 = "WMM-2025";
	var start_date$3 = "2024-11-13T03:00:00.000Z";
	var end_date$3 = "2029-11-13T03:00:00.000Z";
	var wmm2025 = {
		main_field_coeff_g: main_field_coeff_g$3,
		main_field_coeff_h: main_field_coeff_h$3,
		secular_var_coeff_g: secular_var_coeff_g$3,
		secular_var_coeff_h: secular_var_coeff_h$3,
		n_max: n_max$3,
		n_max_sec_var: n_max_sec_var$3,
		epoch: epoch$3,
		name: name$3,
		start_date: start_date$3,
		end_date: end_date$3
	};

	var wmm2025$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		main_field_coeff_g: main_field_coeff_g$3,
		main_field_coeff_h: main_field_coeff_h$3,
		secular_var_coeff_g: secular_var_coeff_g$3,
		secular_var_coeff_h: secular_var_coeff_h$3,
		n_max: n_max$3,
		n_max_sec_var: n_max_sec_var$3,
		epoch: epoch$3,
		name: name$3,
		start_date: start_date$3,
		end_date: end_date$3,
		'default': wmm2025
	});

	var main_field_coeff_g$2 = [
		0,
		-29404.5,
		-1450.7,
		-2500,
		2982,
		1676.8,
		1363.9,
		-2381,
		1236.2,
		525.7,
		903.1,
		809.4,
		86.2,
		-309.4,
		47.9,
		-234.4,
		363.1,
		187.8,
		-140.7,
		-151.2,
		13.7,
		65.9,
		65.6,
		73,
		-121.5,
		-36.2,
		13.5,
		-64.7,
		80.6,
		-76.8,
		-8.3,
		56.5,
		15.8,
		6.4,
		-7.2,
		9.8,
		23.6,
		9.8,
		-17.5,
		-0.4,
		-21.1,
		15.3,
		13.7,
		-16.5,
		-0.3,
		5,
		8.2,
		2.9,
		-1.4,
		-1.1,
		-13.3,
		1.1,
		8.9,
		-9.3,
		-11.9,
		-1.9,
		-6.2,
		-0.1,
		1.7,
		-0.9,
		0.6,
		-0.9,
		1.9,
		1.4,
		-2.4,
		-3.9,
		3,
		-1.4,
		-2.5,
		2.4,
		-0.9,
		0.3,
		-0.7,
		-0.1,
		1.4,
		-0.6,
		0.2,
		3.1,
		-2,
		-0.1,
		0.5,
		1.3,
		-1.2,
		0.7,
		0.3,
		0.5,
		-0.2,
		-0.5,
		0.1,
		-1.1,
		-0.3
	];
	var main_field_coeff_h$2 = [
		0,
		0,
		4652.9,
		0,
		-2991.6,
		-734.8,
		0,
		-82.2,
		241.8,
		-542.9,
		0,
		282,
		-158.4,
		199.8,
		-350.1,
		0,
		47.7,
		208.4,
		-121.3,
		32.2,
		99.1,
		0,
		-19.1,
		25,
		52.7,
		-64.4,
		9,
		68.1,
		0,
		-51.4,
		-16.8,
		2.3,
		23.5,
		-2.2,
		-27.2,
		-1.9,
		0,
		8.4,
		-15.3,
		12.8,
		-11.8,
		14.9,
		3.6,
		-6.9,
		2.8,
		0,
		-23.3,
		11.1,
		9.8,
		-5.1,
		-6.2,
		7.8,
		0.4,
		-1.5,
		9.7,
		0,
		3.4,
		-0.2,
		3.5,
		4.8,
		-8.6,
		-0.1,
		-4.2,
		-3.4,
		-0.1,
		-8.8,
		0,
		0,
		2.6,
		-0.5,
		-0.4,
		0.6,
		-0.2,
		-1.7,
		-1.6,
		-3,
		-2,
		-2.6,
		0,
		-1.2,
		0.5,
		1.3,
		-1.8,
		0.1,
		0.7,
		-0.1,
		0.6,
		0.2,
		-0.9,
		0,
		0.5
	];
	var secular_var_coeff_g$2 = [
		0,
		6.7,
		7.7,
		-11.5,
		-7.1,
		-2.2,
		2.8,
		-6.2,
		3.4,
		-12.2,
		-1.1,
		-1.6,
		-6,
		5.4,
		-5.5,
		-0.3,
		0.6,
		-0.7,
		0.1,
		1.2,
		1,
		-0.6,
		-0.4,
		0.5,
		1.4,
		-1.4,
		0,
		0.8,
		-0.1,
		-0.3,
		-0.1,
		0.7,
		0.2,
		-0.5,
		-0.8,
		1,
		-0.1,
		0.1,
		-0.1,
		0.5,
		-0.1,
		0.4,
		0.5,
		0,
		0.4,
		-0.1,
		-0.2,
		0,
		0.4,
		-0.3,
		0,
		0.3,
		0,
		0,
		-0.4,
		0,
		0,
		0,
		0.2,
		-0.1,
		-0.2,
		0,
		-0.1,
		-0.2,
		-0.1,
		0,
		0,
		-0.1,
		0,
		0,
		0,
		-0.1,
		0,
		0,
		-0.1,
		-0.1,
		-0.1,
		-0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-0.1
	];
	var secular_var_coeff_h$2 = [
		0,
		0,
		-25.1,
		0,
		-30.2,
		-23.9,
		0,
		5.7,
		-1,
		1.1,
		0,
		0.2,
		6.9,
		3.7,
		-5.6,
		0,
		0.1,
		2.5,
		-0.9,
		3,
		0.5,
		0,
		0.1,
		-1.8,
		-1.4,
		0.9,
		0.1,
		1,
		0,
		0.5,
		0.6,
		-0.7,
		-0.2,
		-1.2,
		0.2,
		0.3,
		0,
		-0.3,
		0.7,
		-0.2,
		0.5,
		-0.3,
		-0.5,
		0.4,
		0.1,
		0,
		-0.3,
		0.2,
		-0.4,
		0.4,
		0.1,
		0,
		-0.2,
		0.5,
		0.2,
		0,
		0,
		0.1,
		-0.3,
		0.1,
		-0.2,
		0.1,
		0,
		-0.1,
		0.2,
		0,
		0,
		0,
		0.1,
		0,
		0.2,
		0,
		0,
		0.1,
		0,
		-0.1,
		0,
		0,
		0,
		0,
		0,
		-0.1,
		0.1,
		0,
		0,
		0,
		0.1,
		0,
		0,
		0,
		-0.1
	];
	var n_max$2 = 12;
	var n_max_sec_var$2 = 12;
	var epoch$2 = 2020;
	var name$2 = "WMM-2020";
	var start_date$2 = "2019-12-10T08:00:00.000Z";
	var end_date$2 = "2024-12-10T08:00:00.000Z";
	var wmm2020 = {
		main_field_coeff_g: main_field_coeff_g$2,
		main_field_coeff_h: main_field_coeff_h$2,
		secular_var_coeff_g: secular_var_coeff_g$2,
		secular_var_coeff_h: secular_var_coeff_h$2,
		n_max: n_max$2,
		n_max_sec_var: n_max_sec_var$2,
		epoch: epoch$2,
		name: name$2,
		start_date: start_date$2,
		end_date: end_date$2
	};

	var wmm2020$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		main_field_coeff_g: main_field_coeff_g$2,
		main_field_coeff_h: main_field_coeff_h$2,
		secular_var_coeff_g: secular_var_coeff_g$2,
		secular_var_coeff_h: secular_var_coeff_h$2,
		n_max: n_max$2,
		n_max_sec_var: n_max_sec_var$2,
		epoch: epoch$2,
		name: name$2,
		start_date: start_date$2,
		end_date: end_date$2,
		'default': wmm2020
	});

	var main_field_coeff_g$1 = [
		0,
		-29438.2,
		-1493.5,
		-2444.5,
		3014.7,
		1679,
		1351.8,
		-2351.6,
		1223.6,
		582.3,
		907.5,
		814.8,
		117.8,
		-335.6,
		69.7,
		-232.9,
		360.1,
		191.7,
		-141.3,
		-157.2,
		7.7,
		69.4,
		67.7,
		72.3,
		-129.1,
		-28.4,
		13.6,
		-70.3,
		81.7,
		-75.9,
		-7.1,
		52.2,
		15,
		9.1,
		-3,
		5.9,
		24.2,
		8.9,
		-16.9,
		-3.1,
		-20.7,
		13.3,
		11.6,
		-16.3,
		-2.1,
		5.5,
		8.8,
		3,
		-3.2,
		0.6,
		-13.2,
		-0.1,
		8.7,
		-9.1,
		-10.4,
		-2,
		-6.1,
		0.2,
		0.6,
		-0.5,
		1.8,
		-0.7,
		2.2,
		2.4,
		-1.8,
		-3.6,
		3,
		-1.4,
		-2.3,
		2.1,
		-0.8,
		0.6,
		-0.7,
		0.1,
		1.7,
		-0.2,
		0.4,
		3.5,
		-2,
		-0.1,
		0.5,
		1.2,
		-0.9,
		0.9,
		0.1,
		0.6,
		-0.4,
		-0.5,
		0.2,
		-0.9,
		0
	];
	var main_field_coeff_h$1 = [
		0,
		0,
		4796.3,
		0,
		-2842.4,
		-638.8,
		0,
		-113.7,
		246.5,
		-537.4,
		0,
		283.3,
		-188.6,
		180.7,
		-330,
		0,
		46.9,
		196.5,
		-119.9,
		16,
		100.6,
		0,
		-20.1,
		32.8,
		59.1,
		-67.1,
		8.1,
		61.9,
		0,
		-54.3,
		-19.5,
		6,
		24.5,
		3.5,
		-27.7,
		-2.9,
		0,
		10.1,
		-18.3,
		13.3,
		-14.5,
		16.2,
		6,
		-9.2,
		2.4,
		0,
		-21.8,
		10.7,
		11.8,
		-6.8,
		-6.9,
		7.9,
		1,
		-3.9,
		8.5,
		0,
		3.3,
		-0.4,
		4.6,
		4.4,
		-7.9,
		-0.6,
		-4.2,
		-2.9,
		-1.1,
		-8.8,
		0,
		0,
		2.1,
		-0.6,
		-1.1,
		0.7,
		-0.2,
		-2.1,
		-1.5,
		-2.6,
		-2,
		-2.3,
		0,
		-1,
		0.3,
		1.8,
		-2.2,
		0.3,
		0.7,
		-0.1,
		0.3,
		0.2,
		-0.9,
		-0.2,
		0.8
	];
	var secular_var_coeff_g$1 = [
		0,
		7,
		9,
		-11,
		-6.2,
		0.3,
		2.4,
		-5.7,
		2,
		-11,
		-0.8,
		-0.9,
		-6.5,
		5.2,
		-4,
		-0.3,
		0.6,
		-0.8,
		0.1,
		1.2,
		1.4,
		-0.8,
		-0.5,
		-0.1,
		1.6,
		-1.6,
		0,
		1.2,
		-0.3,
		-0.2,
		-0.3,
		0.9,
		0.1,
		-0.6,
		-0.9,
		0.7,
		-0.1,
		0.2,
		-0.2,
		0.5,
		-0.1,
		0.4,
		0.4,
		-0.1,
		0.4,
		-0.1,
		-0.1,
		0,
		0.4,
		-0.4,
		0,
		0.3,
		0,
		0,
		-0.3,
		0,
		0,
		-0.1,
		0.2,
		-0.1,
		-0.2,
		0,
		-0.1,
		-0.2,
		-0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		-0.1,
		0,
		0,
		0,
		-0.1,
		0,
		-0.1,
		0,
		0,
		0,
		0,
		-0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-0.1
	];
	var secular_var_coeff_h$1 = [
		0,
		0,
		-30.2,
		0,
		-29.6,
		-17.3,
		0,
		6.5,
		-0.8,
		-2,
		0,
		-0.4,
		5.8,
		3.8,
		-3.5,
		0,
		0.2,
		2.3,
		0,
		3.3,
		-0.6,
		0,
		0.3,
		-1.5,
		-1.2,
		0.4,
		0.2,
		1.3,
		0,
		0.6,
		0.5,
		-0.8,
		-0.2,
		-1.1,
		0.1,
		0.2,
		0,
		-0.4,
		0.6,
		-0.1,
		0.6,
		-0.2,
		-0.5,
		0.5,
		0.1,
		0,
		-0.3,
		0.1,
		-0.4,
		0.3,
		0.1,
		0,
		-0.1,
		0.5,
		0.2,
		0,
		0,
		0.1,
		-0.2,
		0.1,
		-0.1,
		0.1,
		0,
		-0.1,
		0.2,
		0,
		0,
		0,
		0.1,
		0,
		0.1,
		0,
		0,
		0.1,
		0,
		-0.1,
		0,
		-0.1,
		0,
		0,
		0,
		-0.1,
		0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-0.1
	];
	var n_max$1 = 12;
	var n_max_sec_var$1 = 12;
	var epoch$1 = 2015;
	var name$1 = "WMM-2015v2";
	var start_date$1 = "2018-09-18T06:00:00.000Z";
	var end_date$1 = "2023-09-18T06:00:00.000Z";
	var wmm2015v2 = {
		main_field_coeff_g: main_field_coeff_g$1,
		main_field_coeff_h: main_field_coeff_h$1,
		secular_var_coeff_g: secular_var_coeff_g$1,
		secular_var_coeff_h: secular_var_coeff_h$1,
		n_max: n_max$1,
		n_max_sec_var: n_max_sec_var$1,
		epoch: epoch$1,
		name: name$1,
		start_date: start_date$1,
		end_date: end_date$1
	};

	var wmm2015v2$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		main_field_coeff_g: main_field_coeff_g$1,
		main_field_coeff_h: main_field_coeff_h$1,
		secular_var_coeff_g: secular_var_coeff_g$1,
		secular_var_coeff_h: secular_var_coeff_h$1,
		n_max: n_max$1,
		n_max_sec_var: n_max_sec_var$1,
		epoch: epoch$1,
		name: name$1,
		start_date: start_date$1,
		end_date: end_date$1,
		'default': wmm2015v2
	});

	var main_field_coeff_g = [
		0,
		-29438.5,
		-1501.1,
		-2445.3,
		3012.5,
		1676.6,
		1351.1,
		-2352.3,
		1225.6,
		581.9,
		907.2,
		813.7,
		120.3,
		-335,
		70.3,
		-232.6,
		360.1,
		192.4,
		-141,
		-157.4,
		4.3,
		69.5,
		67.4,
		72.8,
		-129.8,
		-29,
		13.2,
		-70.9,
		81.6,
		-76.1,
		-6.8,
		51.9,
		15,
		9.3,
		-2.8,
		6.7,
		24,
		8.6,
		-16.9,
		-3.2,
		-20.6,
		13.3,
		11.7,
		-16,
		-2,
		5.4,
		8.8,
		3.1,
		-3.1,
		0.6,
		-13.3,
		-0.1,
		8.7,
		-9.1,
		-10.5,
		-1.9,
		-6.5,
		0.2,
		0.6,
		-0.6,
		1.7,
		-0.7,
		2.1,
		2.3,
		-1.8,
		-3.6,
		3.1,
		-1.5,
		-2.3,
		2.1,
		-0.9,
		0.6,
		-0.7,
		0.2,
		1.7,
		-0.2,
		0.4,
		3.5,
		-2,
		-0.3,
		0.4,
		1.3,
		-0.9,
		0.9,
		0.1,
		0.5,
		-0.4,
		-0.4,
		0.2,
		-0.9,
		0
	];
	var main_field_coeff_h = [
		0,
		0,
		4796.2,
		0,
		-2845.6,
		-642,
		0,
		-115.3,
		245,
		-538.3,
		0,
		283.4,
		-188.6,
		180.9,
		-329.5,
		0,
		47.4,
		196.9,
		-119.4,
		16.1,
		100.1,
		0,
		-20.7,
		33.2,
		58.8,
		-66.5,
		7.3,
		62.5,
		0,
		-54.1,
		-19.4,
		5.6,
		24.4,
		3.3,
		-27.5,
		-2.3,
		0,
		10.2,
		-18.1,
		13.2,
		-14.6,
		16.2,
		5.7,
		-9.1,
		2.2,
		0,
		-21.6,
		10.8,
		11.7,
		-6.8,
		-6.9,
		7.8,
		1,
		-3.9,
		8.5,
		0,
		3.3,
		-0.3,
		4.6,
		4.4,
		-7.9,
		-0.6,
		-4.1,
		-2.8,
		-1.1,
		-8.7,
		0,
		-0.1,
		2.1,
		-0.7,
		-1.1,
		0.7,
		-0.2,
		-2.1,
		-1.5,
		-2.5,
		-2,
		-2.3,
		0,
		-1,
		0.5,
		1.8,
		-2.2,
		0.3,
		0.7,
		-0.1,
		0.3,
		0.2,
		-0.9,
		-0.2,
		0.7
	];
	var secular_var_coeff_g = [
		0,
		10.7,
		17.9,
		-8.6,
		-3.3,
		2.4,
		3.1,
		-6.2,
		-0.4,
		-10.4,
		-0.4,
		0.8,
		-9.2,
		4,
		-4.2,
		-0.2,
		0.1,
		-1.4,
		0,
		1.3,
		3.8,
		-0.5,
		-0.2,
		-0.6,
		2.4,
		-1.1,
		0.3,
		1.5,
		0.2,
		-0.2,
		-0.4,
		1.3,
		0.2,
		-0.4,
		-0.9,
		0.3,
		0,
		0.1,
		-0.5,
		0.5,
		-0.2,
		0.4,
		0.2,
		-0.4,
		0.3,
		0,
		-0.1,
		-0.1,
		0.4,
		-0.5,
		-0.2,
		0.1,
		0,
		-0.2,
		-0.1,
		0,
		0,
		-0.1,
		0.3,
		-0.1,
		-0.1,
		-0.1,
		0,
		-0.2,
		-0.1,
		-0.2,
		0,
		0,
		-0.1,
		0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		-0.1,
		-0.1,
		0.1,
		0,
		0,
		0.1,
		-0.1,
		0,
		0.1,
		0,
		0,
		0,
		0,
		0,
		0
	];
	var secular_var_coeff_h = [
		0,
		0,
		-26.8,
		0,
		-27.1,
		-13.3,
		0,
		8.4,
		-0.4,
		2.3,
		0,
		-0.6,
		5.3,
		3,
		-5.3,
		0,
		0.4,
		1.6,
		-1.1,
		3.3,
		0.1,
		0,
		0,
		-2.2,
		-0.7,
		0.1,
		1,
		1.3,
		0,
		0.7,
		0.5,
		-0.2,
		-0.1,
		-0.7,
		0.1,
		0.1,
		0,
		-0.3,
		0.3,
		0.3,
		0.6,
		-0.1,
		-0.2,
		0.3,
		0,
		0,
		-0.2,
		-0.1,
		-0.2,
		0.1,
		0.1,
		0,
		-0.2,
		0.4,
		0.3,
		0,
		0.1,
		-0.1,
		0,
		0,
		-0.2,
		0.1,
		-0.1,
		-0.2,
		0.1,
		-0.1,
		0,
		0,
		0.1,
		0,
		0.1,
		0,
		0,
		0.1,
		0,
		-0.1,
		0,
		-0.1,
		0,
		0,
		0,
		-0.1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	];
	var n_max = 12;
	var n_max_sec_var = 12;
	var epoch = 2015;
	var name = "WMM-2015";
	var start_date = "2014-12-15T07:00:00.000Z";
	var end_date = "2019-12-15T07:00:00.000Z";
	var wmm2015 = {
		main_field_coeff_g: main_field_coeff_g,
		main_field_coeff_h: main_field_coeff_h,
		secular_var_coeff_g: secular_var_coeff_g,
		secular_var_coeff_h: secular_var_coeff_h,
		n_max: n_max,
		n_max_sec_var: n_max_sec_var,
		epoch: epoch,
		name: name,
		start_date: start_date,
		end_date: end_date
	};

	var wmm2015$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		main_field_coeff_g: main_field_coeff_g,
		main_field_coeff_h: main_field_coeff_h,
		secular_var_coeff_g: secular_var_coeff_g,
		secular_var_coeff_h: secular_var_coeff_h,
		n_max: n_max,
		n_max_sec_var: n_max_sec_var,
		epoch: epoch,
		name: name,
		start_date: start_date,
		end_date: end_date,
		'default': wmm2015
	});

	var require$$0 = getCjsExportFromNamespace(wmm2025$1);

	var require$$1 = getCjsExportFromNamespace(wmm2020$1);

	var require$$2 = getCjsExportFromNamespace(wmm2015v2$1);

	var require$$3 = getCjsExportFromNamespace(wmm2015$1);

	var geomagnetism_1 = createCommonjsModule(function (module) {
	const geomagnetism = module.exports = {};

	const modelData = [
		{
			file: require$$0,
			startDate: new Date("2024-11-13T03:00:00.000Z"),
			endDate: new Date("2029-11-13T03:00:00.000Z")
		},
		{
			file: require$$1,
			startDate: new Date("2019-12-10T08:00:00.000Z"),
			endDate: new Date("2024-12-10T08:00:00.000Z")
		},
		{
			file: require$$2,
			startDate: new Date("2018-09-18T06:00:00.000Z"),
			endDate: new Date("2023-09-18T06:00:00.000Z")
		},
		{
			file: require$$3,
			startDate: new Date("2014-12-15T07:00:00.000Z"),
			endDate: new Date("2019-12-15T07:00:00.000Z")
		}
	];


	geomagnetism.model = function (date, options = {}) {
		date = date || new Date();
		const ts = date.getTime();

		const allowOutOfBoundsModel = (options && options.allowOutOfBoundsModel) || false;

		// Get the latest matching model 
		let matchingModelData = modelData.find((model) => {
			return ts >= model.startDate.getTime() && ts <= model.endDate.getTime();
		});

		// Get if the date is before the first model or after the last model
		if (!matchingModelData && ts < modelData[modelData.length - 1].startDate.getTime()) {
			matchingModelData = modelData[modelData.length - 1];
		} else if (!matchingModelData && ts > modelData[0].endDate.getTime()) {
			matchingModelData = modelData[0];
		}

		// If no matching model found, use the latest
		if (!matchingModelData) {
			matchingModelData = modelData[0]; // latest (will throw error if allowOutOfBoundsModel is true)
		}

		const matchingModel = new model(matchingModelData.file);

		return matchingModel.getTimedModel(date, allowOutOfBoundsModel);
	};
	});

	return geomagnetism_1;

}));
