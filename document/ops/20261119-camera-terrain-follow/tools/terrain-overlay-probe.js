/* Browser-only experiment. No SDK cache mutations; not a production renderer.
 * Input snapshots are supplied by the harness; queryTerrainElevation reads loaded DEM.
 * Lines use screen-width triangles and points use circular sprites. Sharp joins,
 * terrain occlusion at grazing angles and glow parity still require visual review.
 */
globalThis.installTerrainOverlayProbe = (map, descriptors, readData) => {
  const id = "spinatlas-terrain-overlay-probe";
  const stats = { renders: 0, uploads: 0, vertices: 0, missingElevation: 0, segments: 0, points: 0, released: false, gpuSamples: 0, gpuVisibleSamples: 0 };
  const center = map.getCenter();
  const earth = 40075016.68557849;
  const mercator = ([lng, lat], height) => {
    const radians = lat * Math.PI / 180;
    return [(lng + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2,
      height / (earth * Math.cos(radians))];
  };
  const origin = mercator([center.lng, center.lat], 0);
  let groups = [];
  let at = -Infinity;
  let last = [];
  let override = null;
  const input = source => override ? override[source] : readData(source);
  let program, vao, buffer;
  const samples=[];
  const evaluate = (value, properties = {}) => {
    if (!Array.isArray(value)) return value;
    if (value[0] === "literal") return value[1];
    if (value[0] === "zoom") return map.getZoom();
    if (value[0] === "get") return properties[value[1]];
    if (value[0] === "interpolate") {
      const x = evaluate(value[2], properties);
      if (x <= value[3]) return evaluate(value[4], properties);
      for (let i = 5; i < value.length; i += 2) if (x <= value[i]) {
        const lo = evaluate(value[i - 1], properties), hi = evaluate(value[i + 1], properties);
        const t = (x - value[i - 2]) / (value[i] - value[i - 2]);
        return lo + (hi - lo) * t;
      }
      return evaluate(value.at(-1), properties);
    }
    return undefined;
  };
  function rgba(value, opacity) {
    const hex = typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : "#FF3DCE";
    return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).concat(opacity);
  }
  function vertex(point) {
    const elevation = map.queryTerrainElevation(point, { exaggerated: true });
    if (!Number.isFinite(elevation)) { stats.missingElevation++; return null; }
    const p = mercator(point, elevation + 0.12);
    return p.map((n, i) => n - origin[i]);
  }
  function rebuild() {
    groups = [];
    let segments = 0, points = 0;
    for (const descriptor of descriptors) {
      const data = input(descriptor.source);
      const features = data?.type === "FeatureCollection" ? data.features : data?.type === "Feature" ? [data] : [];
      for (const feature of features) {
        const paint = descriptor.paint;
        const isPoint = descriptor.type === "circle";
        const prefix = isPoint ? "circle-" : "line-";
        const width = Number(evaluate(paint[prefix + (isPoint ? "radius" : "width")], feature.properties) ?? (isPoint ? 4 : 8));
        const opacity = Number(evaluate(paint[prefix + "opacity"], feature.properties) ?? 1);
        if (!(width > 0 && opacity > 0)) continue;
        const values = [];
        const append = (a, b, end, side) => values.push(...a, ...b, end, side);
        const geom = feature.geometry;
        if (isPoint && ["Point", "MultiPoint"].includes(geom?.type)) {
          for (const point of geom.type === "Point" ? [geom.coordinates] : geom.coordinates) {
            const a = vertex(point);
            if (!a) continue;
            append(a, a, 0, 0); points++;
          }
        } else if (!isPoint && ["LineString", "MultiLineString"].includes(geom?.type)) {
          for (const line of geom.type === "LineString" ? [geom.coordinates] : geom.coordinates) {
            for (let i = 1; i < line.length; i++) {
              const a = vertex(line[i - 1]), b = vertex(line[i]);
              if (!a || !b || a.every((n, j) => n === b[j])) continue;
              for (const [end, side] of [[0,-1],[1,-1],[0,1],[0,1],[1,-1],[1,1]]) append(a,b,end,side);
              segments++;
            }
          }
        }
        if (values.length) groups.push({ values: new Float32Array(values), isPoint, width,
          color: rgba(evaluate(paint[prefix + "color"], feature.properties), opacity) });
      }
    }
    stats.segments = segments; stats.points = points;
    stats.vertices = groups.reduce((n, group) => n + group.values.length / 8, 0);
    stats.uploads++;
  }
  const layer = {
    id, type: "custom", renderingMode: "3d",
    onAdd(_map, gl) {
      function shader(type, source) {
        const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
        if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
        return value;
      }
      const vs = shader(gl.VERTEX_SHADER, `#version 300 es
        precision highp float;
        in vec3 a; in vec3 b; in vec2 edge;
        uniform mat4 matrix; uniform vec2 viewport; uniform float width; uniform float point;
        void main() {
          vec4 ac=matrix*vec4(a,1.0), bc=matrix*vec4(b,1.0);
          vec2 delta=(bc.xy/max(bc.w,0.00001)-ac.xy/max(ac.w,0.00001))*viewport;
          vec2 normal=vec2(-delta.y,delta.x)/max(length(delta),0.00001);
          gl_Position=mix(ac,bc,edge.x);
          gl_Position.xy+=normal*edge.y*width/viewport*gl_Position.w;
          gl_PointSize=width*2.0;
        }`);
      const fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
        precision highp float; uniform vec4 color; uniform float point; out vec4 outputColor;
        void main(){if(point>0.5 && length(gl_PointCoord-0.5)>0.5)discard;
          outputColor=vec4(color.rgb*color.a,color.a);}`);
      program = gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      const previous = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
      const oldBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      vao=gl.createVertexArray(); buffer=gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for (const [name,size,offset] of [["a",3,0],["b",3,12],["edge",2,24]]) {
        const loc=gl.getAttribLocation(program,name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offset);
      }
      gl.bindVertexArray(previous); gl.bindBuffer(gl.ARRAY_BUFFER,oldBuffer);
    },
    render(gl, matrix) {
      stats.renders++;
      const now=performance.now();
      const inputs=descriptors.map(d=>input(d.source));
      if (now-at>500 || inputs.some((value,i)=>value!==last[i])) { rebuild(); last=inputs; at=now; }
      const previous={program:gl.getParameter(gl.CURRENT_PROGRAM),vao:gl.getParameter(gl.VERTEX_ARRAY_BINDING),
        buffer:gl.getParameter(gl.ARRAY_BUFFER_BINDING),blend:gl.isEnabled(gl.BLEND),depth:gl.isEnabled(gl.DEPTH_TEST),
        cull:gl.isEnabled(gl.CULL_FACE),stencil:gl.isEnabled(gl.STENCIL_TEST),mask:gl.getParameter(gl.DEPTH_WRITEMASK),
        func:gl.getParameter(gl.DEPTH_FUNC),src:gl.getParameter(gl.BLEND_SRC_RGB),dst:gl.getParameter(gl.BLEND_DST_RGB),
        srcA:gl.getParameter(gl.BLEND_SRC_ALPHA),dstA:gl.getParameter(gl.BLEND_DST_ALPHA)};
      const translated=Array.from(matrix);
      for(let i=0;i<4;i++) translated[12+i]+=matrix[i]*origin[0]+matrix[4+i]*origin[1]+matrix[8+i]*origin[2];
      if(groups.length && stats.renders%30===0) {
        const projectedEndpoints=groups.flatMap(group=>{
          const v=group.values, results=[];
          for(let k=0;k<v.length;k+=8)for(const offset of [0,3]) {
            const p=[0,1,2,3].map(i=>translated[i]*v[k+offset]+translated[4+i]*v[k+offset+1]+translated[8+i]*v[k+offset+2]+translated[12+i]);
            results.push(p);
          }
          return results;
        });
        stats.maxClipW=Math.max(...projectedEndpoints.map(p=>p[3]));
        stats.inViewport=projectedEndpoints.filter(p=>p[3]>0&&p.slice(0,3).every(v=>Math.abs(v)<=p[3])).length;
        stats.projected=groups.slice(0,4).map(group=>{
          const a=group.values;
          const p=[0,1,2,3].map(i=>translated[i]*a[0]+translated[4+i]*a[1]+translated[8+i]*a[2]+translated[12+i]);
          return {clip:p,ndc:p.slice(0,3).map(v=>v/p[3]),width:group.width,color:group.color};
        });
        stats.matrixLength=matrix.length;
      }
      gl.useProgram(program); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
      gl.disable(gl.CULL_FACE); gl.disable(gl.STENCIL_TEST); gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      const uniform=name=>gl.getUniformLocation(program,name);
      gl.uniformMatrix4fv(uniform("matrix"),false,new Float32Array(translated));
      gl.uniform2f(uniform("viewport"),gl.drawingBufferWidth,gl.drawingBufferHeight);
      const dpr=gl.drawingBufferWidth/map.getCanvas().clientWidth;
      for(let i=samples.length-1;i>=0;i--) if(gl.getQueryParameter(samples[i],gl.QUERY_RESULT_AVAILABLE)) {
        stats.gpuSamples++; if(gl.getQueryParameter(samples[i],gl.QUERY_RESULT))stats.gpuVisibleSamples++;
        gl.deleteQuery(samples[i]); samples.splice(i,1);
      }
      const sample=stats.renders%30===0?gl.createQuery():null;
      if(sample)gl.beginQuery(gl.ANY_SAMPLES_PASSED,sample);
      for(const group of groups) {
        gl.bufferData(gl.ARRAY_BUFFER,group.values,gl.DYNAMIC_DRAW);
        gl.uniform1f(uniform("width"),group.width*dpr); gl.uniform1f(uniform("point"),group.isPoint?1:0);
        gl.uniform4fv(uniform("color"),group.color);
        gl.drawArrays(group.isPoint?gl.POINTS:gl.TRIANGLES,0,group.values.length/8);
      }
      if(sample){gl.endQuery(gl.ANY_SAMPLES_PASSED);samples.push(sample);}
      if(sample)stats.glError=gl.getError();
      gl.useProgram(previous.program); gl.bindVertexArray(previous.vao); gl.bindBuffer(gl.ARRAY_BUFFER,previous.buffer);
      for (const [key,enabled] of [[gl.BLEND,previous.blend],[gl.DEPTH_TEST,previous.depth],[gl.CULL_FACE,previous.cull],[gl.STENCIL_TEST,previous.stencil]]) {
        if(enabled)gl.enable(key);else gl.disable(key);
      }
      gl.depthMask(previous.mask); gl.depthFunc(previous.func);
      gl.blendFuncSeparate(previous.src,previous.dst,previous.srcA,previous.dstA);
    },
    onRemove(_map,gl) { for(const query of samples)gl.deleteQuery(query); gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program); stats.released=true; },
  };
  const rider=map.getLayer("boxcycle-rider-preserved-layer")?"boxcycle-rider-preserved-layer":undefined;
  map.addLayer(layer,rider);
  return { stats, replaceData(data) { override=data; at=-Infinity; map.triggerRepaint(); },
    remove:()=>map.getLayer(id)&&map.removeLayer(id) };
};
