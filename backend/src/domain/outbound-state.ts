export type OutboundAction="mismatch"|"approve_short"|"cancel"|"return_cancel"|"reassign";
const allowed:Record<OutboundAction,string[]>={mismatch:["checking"],approve_short:["checking"],cancel:["draft","ready_to_pick","picking","needs_repick"],return_cancel:["picked"],reassign:["ready_to_pick","picking","picked","checking","needs_repick"]};
export function assertOutboundAction(status:string,action:OutboundAction){if(!allowed[action].includes(status))throw new Error("INVALID_TRANSITION");}
