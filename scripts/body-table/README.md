# Body table

`src/engine/bodyShape.ts` is generated from MakeHuman's base body (CC0, makehumancommunity.org): the young female
average (the caucasian, african and asian female-young targets at a third each), arms cut off at the armhole, sliced
into level rings at each height of the app's form and scaled to the example body's girths. The mesh itself is not in
the repo.

To rebuild:

```sh
mkdir mh && cd mh
curl -LO https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj
for t in caucasian african asian; do
  curl -L -o $t-female-young.target https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/targets/macrodetails/$t-female-young.target
done
cd ..
python3 -I scripts/body-table/build_table.py mh/base.obj src/engine/bodyShape.ts \
  --target mh/caucasian-female-young.target:0.3334 \
  --target mh/african-female-young.target:0.3333 \
  --target mh/asian-female-young.target:0.3333
```

Needs numpy. The landmarks (where the body's heights land on the form) and the example girths are at the top of
`build_table.py`.
