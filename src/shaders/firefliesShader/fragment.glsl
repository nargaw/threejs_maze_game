void main(){
    float distanceToCenter=distance(gl_PointCoord,vec2(.5));
    float strength=.05/distanceToCenter-.05*2.;
    gl_FragColor=vec4(1.,1.,1.,strength);
}
