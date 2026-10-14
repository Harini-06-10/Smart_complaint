/**
 * Labelled sample complaints used to train the Naive Bayes category classifier.
 * Add more lines here to make the AI smarter – it retrains on every server start.
 * A few common Tamil / Tanglish words are included (kuzhi, kuppai, thanni, vilakku…)
 */
module.exports = [
  // ---- Pothole ----
  ['big pothole in the middle of the road vehicles getting damaged', 'Pothole'],
  ['deep pit on the main road two wheelers falling', 'Pothole'],
  ['potholes filled with rain water near bus stop', 'Pothole'],
  ['road has many holes and craters dangerous for bikes', 'Pothole'],
  ['large hole on street near school causing accidents', 'Pothole'],
  ['road la periya kuzhi irukku bike vizhuthu', 'Pothole'],
  ['pothole near junction not repaired for weeks', 'Pothole'],

  // ---- Road Damage ----
  ['road surface completely damaged and broken after rain', 'Road Damage'],
  ['tar road washed away uneven surface', 'Road Damage'],
  ['newly laid road cracked and sinking', 'Road Damage'],
  ['speed breaker broken road dug up and left unfinished', 'Road Damage'],
  ['footpath broken pavement tiles missing pedestrians tripping', 'Road Damage'],

  // ---- Garbage Accumulation ----
  ['garbage dumped on the street not collected for days', 'Garbage Accumulation'],
  ['waste bin overflowing foul smell and stray dogs', 'Garbage Accumulation'],
  ['trash piled up near market mosquitoes breeding', 'Garbage Accumulation'],
  ['garbage truck has not come to our street this week', 'Garbage Accumulation'],
  ['plastic waste and debris dumped in empty plot', 'Garbage Accumulation'],
  ['kuppai romba naal edukala smell adikudhu', 'Garbage Accumulation'],
  ['dead animal carcass lying on road stinking', 'Garbage Accumulation'],

  // ---- Drainage Blockage ----
  ['drainage blocked sewage overflowing onto the road', 'Drainage Blockage'],
  ['storm water drain clogged causing flooding in street', 'Drainage Blockage'],
  ['manhole open and sewage water flowing', 'Drainage Blockage'],
  ['gutter choked with silt bad smell everywhere', 'Drainage Blockage'],
  ['rain water stagnating because drain is blocked', 'Drainage Blockage'],
  ['sewer line overflow into houses', 'Drainage Blockage'],

  // ---- Water Leakage ----
  ['drinking water pipe leaking water wasted on road', 'Water Leakage'],
  ['water pipeline burst near the junction', 'Water Leakage'],
  ['no water supply for three days in our area', 'Water Leakage'],
  ['contaminated muddy water coming in tap', 'Water Leakage'],
  ['metro water line leakage continuously flowing', 'Water Leakage'],
  ['thanni pipe odanji thanni waste aagudhu', 'Water Leakage'],

  // ---- Streetlight Not Working ----
  ['street light not working whole street is dark at night', 'Streetlight Not Working'],
  ['streetlamp flickering and switched off since last week', 'Streetlight Not Working'],
  ['lights on the pole are not glowing unsafe for women at night', 'Streetlight Not Working'],
  ['street light burning during day time wasting electricity', 'Streetlight Not Working'],
  ['dark road no lighting near bus stop', 'Streetlight Not Working'],
  ['theru vilakku eriyala night la iruttu', 'Streetlight Not Working'],

  // ---- Exposed Electric Wire ----
  ['live electric wire hanging low on the street danger', 'Exposed Electric Wire'],
  ['electric cable fallen on road after storm sparks', 'Exposed Electric Wire'],
  ['transformer sparking and open junction box', 'Exposed Electric Wire'],
  ['exposed wires near school children may get electrocuted', 'Exposed Electric Wire'],
  ['current wire arundhu road la kidakku', 'Exposed Electric Wire'],
  ['electric pole tilted wires touching tree', 'Exposed Electric Wire'],

  // ---- Traffic Signal Damage ----
  ['traffic signal not working at the junction causing jam', 'Traffic Signal Damage'],
  ['signal lights stuck on red vehicles confused', 'Traffic Signal Damage'],
  ['traffic light pole knocked down by vehicle', 'Traffic Signal Damage'],
  ['pedestrian crossing signal broken', 'Traffic Signal Damage'],
  ['sign board fallen and zebra crossing faded', 'Traffic Signal Damage'],

  // ---- Fallen Tree ----
  ['tree fell on the road blocking traffic after rain', 'Fallen Tree'],
  ['huge branch broken and hanging over the street', 'Fallen Tree'],
  ['uprooted tree fallen on parked cars', 'Fallen Tree'],
  ['dead tree likely to fall on houses needs cutting', 'Fallen Tree'],
  ['maram vizhundhu road block aayiduchu', 'Fallen Tree'],
  ['overgrown tree branches touching power lines', 'Fallen Tree'],

  // ---- Damaged Public Property ----
  ['bus shelter roof broken and seats damaged', 'Damaged Public Property'],
  ['public toilet damaged and not maintained', 'Damaged Public Property'],
  ['park bench broken and compound wall collapsed', 'Damaged Public Property'],
  ['government school wall cracked dangerous', 'Damaged Public Property'],
  ['public building railing broken and staircase damaged', 'Damaged Public Property'],
  ['playground equipment broken children injured', 'Damaged Public Property'],

  // ---- Other ----
  ['stray dogs menace in our area', 'Other'],
  ['loud noise from construction late at night', 'Other'],
  ['illegal encroachment on footpath by shops', 'Other'],
  ['mosquito fogging not done in our ward', 'Other'],
];
