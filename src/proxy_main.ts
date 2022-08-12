import { portFinder } from "./port_finder";

(async () => console.log("found port:", await portFinder.findAfter(8388)))();