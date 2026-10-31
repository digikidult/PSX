/* Execute only the verified game's Thumb evolution checker in isolated memory. */
(function(root){'use strict';
const BASE=0x02000000,MAX=0xffffffff;
const sx=(x,bits)=>bits===32?x|0:(x<<(32-bits))>>(32-bits);
class EvolutionVM{
 constructor(blob,entry){this.blob=blob;this.mem=new Uint8Array(4096);this.r=new Uint32Array(16);this.r[13]=0xf00;this.r[14]=0x10001;this.r[15]=BASE+entry;this.n=this.z=this.c=this.v=false;this.steps=0;}
 read(a,n){let data,offset;if(a>=BASE&&a+n<=BASE+this.blob.length){data=this.blob;offset=a-BASE;}else if(a>=0&&a+n<=this.mem.length){data=this.mem;offset=a;}else throw Error('原版判定讀取範圍不符');let v=0;for(let i=0;i<n;i++)v+=data[offset+i]*2**(8*i);return v>>>0;}
 write(a,v,n){if(a<0||a+n>this.mem.length)throw Error('原版判定寫入範圍不符');for(let i=0;i<n;i++)this.mem[a+i]=v>>>(8*i)&255;}
 nz(v){v>>>=0;this.n=!!(v&0x80000000);this.z=v===0;return v;}
 arith(a,b,sub=false){a>>>=0;b>>>=0;let value=sub?a-b:a+b,v=value>>>0;this.nz(v);this.c=sub?a>=b:value>MAX;this.v=!!((sub?(a^b)&(a^v):~(a^b)&(a^v))&0x80000000);return v;}
 run(){const r=this.r;while(r[15]!==0x10000){if(++this.steps>200000)throw Error('原版進化判定超出執行上限');const pc=r[15],h=this.read(pc,2);r[15]=pc+2;
  if((h&0xf800)===0xf000){const next=this.read(pc+2,2);if((next&0xf800)!==0xf800)throw Error('不支援的跳轉指令');r[14]=(pc+4)|1;r[15]=pc+4+(sx(h&2047,11)<<12)+((next&2047)<<1);continue;}
  if((h&0xf600)===0xb400){const pop=!!(h&0x800),regs=[];for(let i=0;i<8;i++)if(h>>i&1)regs.push(i);if(h&0x100)regs.push(pop?15:14);if(pop){for(const i of regs){r[i]=this.read(r[13],4);r[13]+=4;}if(regs.includes(15))r[15]&=0xfffffffe;}else{r[13]-=4*regs.length;regs.forEach((i,j)=>this.write(r[13]+j*4,r[i],4));}continue;}
  if((h&0xfc00)===0x4400){const op=h>>8&3,d=(h&7)|(h>>4&8),s=h>>3&15,a=d===15?pc+4:r[d],b=s===15?pc+4:r[s];if(op===0)r[d]=a+b;else if(op===1)this.arith(a,b,true);else if(op===2)r[d]=b;else r[15]=b&0xfffffffe;continue;}
  if((h&0xf000)===0xd000){const cond=h>>8&15,flags=[this.z,!this.z,this.c,!this.c,this.n,!this.n,this.v,!this.v,this.c&&!this.z,!this.c||this.z,this.n===this.v,this.n!==this.v,!this.z&&this.n===this.v,this.z||this.n!==this.v];if(cond>=14)throw Error('不支援的條件指令');if(flags[cond])r[15]=pc+4+(sx(h&255,8)<<1);continue;}
  if((h&0xf800)===0xe000){r[15]=pc+4+(sx(h&2047,11)<<1);continue;}
  if((h&0xf800)===0x4800){r[h>>8&7]=this.read(((pc+4)&~3)+((h&255)<<2),4);continue;}
  if((h&0xf000)===0x5000){const op=h>>9&7,d=h&7,a=r[h>>3&7]+r[h>>6&7],sizes=[4,2,1,1,4,2,1,2],n=sizes[op];if(op<3)this.write(a,r[d],n);else{let v=this.read(a,n);if(op===3||op===7)v=sx(v,n*8);r[d]=v;}continue;}
  if((h&0xe000)===0x6000||(h&0xf000)===0x8000){const d=h&7,b=h>>3&7,imm=h>>6&31,load=!!(h&0x800),n=(h&0xf000)===0x8000?2:h&0x1000?1:4,a=r[b]+imm*n;if(load)r[d]=this.read(a,n);else this.write(a,r[d],n);continue;}
  if((h&0xe000)===0x2000){const op=h>>11&3,d=h>>8&7,imm=h&255;if(op===0)r[d]=this.nz(imm);else if(op===1)this.arith(r[d],imm,true);else r[d]=this.arith(r[d],imm,op===3);continue;}
  if((h&0xf800)===0x1800){const d=h&7,a=r[h>>3&7],index=h>>6&7,b=h&0x400?index:r[index];r[d]=this.arith(a,b,!!(h&0x200));continue;}
  if((h&0xe000)===0){const op=h>>11&3,n0=h>>6&31,s=h>>3&7,d=h&7,x=r[s];let v,n=n0;if(op===0){if(n)this.c=!!(x>>>(32-n)&1);v=x<<n;}else{n=n||32;this.c=!!(x>>>(n-1)&1);v=op===2?(n===32?(x|0)<0?-1:0:(x|0)>>n):n===32?0:x>>>n;}r[d]=this.nz(v);continue;}
  if((h&0xfc00)===0x4000){const op=h>>6&15,s=h>>3&7,d=h&7,a=r[d],b=r[s];let v;if(op===0)v=a&b;else if(op===1)v=a^b;else if(op===2){const n=b&255;if(n)this.c=n<=32?!!(a>>>(32-n)&1):false;v=n>=32?0:a<<n;}else if(op===3){const n=b&255;if(n)this.c=n<=32?!!(a>>>(n-1)&1):false;v=n>=32?0:a>>>n;}else if(op===8){this.nz(a&b);continue;}else if(op===9){r[d]=this.arith(0,b,true);continue;}else if(op===10){this.arith(a,b,true);continue;}else if(op===12)v=a|b;else if(op===13)v=Math.imul(a,b);else if(op===14)v=a&~b;else if(op===15)v=~b;else throw Error('不支援的原版運算指令');r[d]=this.nz(v);continue;}
  if((h&0xf800)===0xc000){const reg=h>>8&7;let a=r[reg];for(let i=0;i<8;i++)if(h>>i&1){this.write(a,r[i],4);a+=4;}r[reg]=a;continue;}
  throw Error('不支援的原版指令：'+pc.toString(16));
 }return r[0];}
}
root.EvolutionVM=EvolutionVM;if(typeof module!=='undefined')module.exports={EvolutionVM};
})(globalThis);
