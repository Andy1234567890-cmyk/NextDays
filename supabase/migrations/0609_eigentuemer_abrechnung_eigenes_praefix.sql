-- Eigentümer-Abrechnung bekommt ein EIGENES Präfix (EA-) statt "RE-".
--
-- Anlass (Betrieb, 08.09.2026): die Eigentümer-Abrechnung ist keine Rechnung,
-- sondern Rechenschaft über fremdes Geld. Der Eigentümer erbringt der Agentur
-- keine Leistung — es gibt nichts zu berechnen. Die Agentur behält lediglich
-- ihre Provision aus der vereinnahmten Miete ein (SKAT: "the commission is in
-- practice settled through a deduction from the received rent").
--
-- Der Fehler, den das behebt: die Kreise 'owner_statement' und 'invoice'
-- trugen BEIDE das Präfix 'RE-', kannten aber ihren jeweiligen Stand nicht
-- (unique ist (tenant_id, doc_type, year)). Live waren dadurch bei einem
-- Betrieb RE-0003, RE-0004 und RE-0005 doppelt belegt: je einmal Gastrechnung,
-- je einmal Eigentümer-Abrechnung. Eine Nummer, die zwei verschiedene
-- Dokumente bezeichnet, identifiziert keines von beiden — genau das verlangt
-- momsbekendtgørelsen § 58 ("et fortløbende nummer, der identificerer
-- fakturaen").
--
-- next_document_number() liest das Präfix aus der ZEILE, nicht aus seinem
-- Argument. Der geänderte Aufruf im Service greift für bestehende Kreise
-- deshalb nicht — sie müssen hier umgestellt werden.
update public.number_sequences
   set prefix = 'EA-'
 where doc_type = 'owner_statement'
   and prefix = 'RE-';
