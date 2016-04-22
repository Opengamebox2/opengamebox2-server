import test from "tape"
import dev from "../src"

test("dev", (t) => {
  t.plan(1)
  t.equal(true, dev(), "return true")
})
