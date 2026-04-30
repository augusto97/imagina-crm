import{c as s,b as t}from"./main-Bc5DwbVF.js";import{u,a as n,b as i}from"./main-LDBBxV2y.js";/**
 * @license lucide-react v0.451.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=s("CircleX",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]),r=["me","email-signature"];function l(){return u({queryKey:r,queryFn:async()=>(await t.get("/me/email-signature")).data.signature,staleTime:6e4})}function g(){const a=n();return i({mutationFn:async e=>(await t.patch("/me/email-signature",{signature:e})).data.signature,onSuccess:e=>{a.setQueryData(r,e)}})}export{y as C,g as a,l as u};
//# sourceMappingURL=useEmailSignature-CuhrBOTP.js.map
