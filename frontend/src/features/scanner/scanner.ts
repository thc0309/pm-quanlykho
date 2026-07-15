export class KeyboardScanner {
  private buffer="";private last=0;
  constructor(private readonly onScan:(value:string)=>void,private readonly maxGapMs=80,private readonly minLength=3){}
  feed(key:string,time=performance.now()){
    if(key==="Enter"){if(this.buffer.length>=this.minLength)this.onScan(this.buffer);this.buffer="";this.last=0;return}
    if(key.length!==1)return;if(this.last&&time-this.last>this.maxGapMs)this.buffer="";this.buffer+=key;this.last=time;
  }
}
