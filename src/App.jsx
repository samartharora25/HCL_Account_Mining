import { useState } from 'react';
import './App.css';

export default function App() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [answers, setAnswers] = useState({ q1: '', q2: '', q3: '' });
  const [itemScoring, setItemScoring] = useState({});
  const [itemScoringErrors, setItemScoringErrors] = useState({});
  const [isClassifying, setIsClassifying] = useState(false);

  const [apiError, setApiError] = useState('');
  const [result, setResult] = useState(null);
  const [categorizedItems, setCategorizedItems] = useState([]);

  const colors = {
    primaryBlue: '#0057B8',
    primaryPurple: '#6B5B95',
    darkNavy: '#0A1628',
    white: '#FFFFFF',
    lightGray: '#F8FAFC',
    textDark: '#1F2937',
    successGreen: '#22C55E',
    warningOrange: '#F97316',
    infoBlue: '#3B82F6',
    mediumYellow: '#EAB308',
    highRed: '#EF4444',
    lowGray: '#64748B'
  };

  const getCategoryColor = (category) => {
    if (category === 'Automation') return colors.successGreen;
    if (category === 'AI Use Case') return colors.infoBlue;
    if (category === 'Process Fix') return colors.warningOrange;
    if (category === 'Classifying...') return '#94A3B8';
    return colors.lowGray;
  };

  const handleStart = () => {
    if (name.trim() && account.trim()) {
      setStep(2);
    }
  };

  const handleProceedToCategorization = async () => {
    const q1Lines = answers.q1.split('\n').map(l => l.trim()).filter(Boolean);
    const q2Lines = answers.q2.split('\n').map(l => l.trim()).filter(Boolean);
    const q3Lines = answers.q3.split('\n').map(l => l.trim()).filter(Boolean);
    const allLines = [...new Set([...q1Lines, ...q2Lines, ...q3Lines])];

    if (allLines.length === 0) {
      alert('Please enter at least one pain point to continue.');
      return;
    }

    // Identify which items already have a valid category
    const validCategories = ['Automation', 'AI Use Case', 'Process Fix'];
    const existingMap = new Map(
      (categorizedItems || [])
        .filter(item => validCategories.includes(item.category))
        .map(item => [item.text, item])
    );

    // Items that need to be classified by the API
    const itemsToClassify = allLines.filter(text => !existingMap.has(text));

    // If nothing needs classification, we can immediately route to step 3 with existing categories
    if (itemsToClassify.length === 0) {
      const updatedClassified = allLines.map(text => {
        const existing = existingMap.get(text);
        return {
          text,
          source: q1Lines.includes(text) ? 'q1' : q2Lines.includes(text) ? 'q2' : 'q3',
          category: existing.category,
          reason: existing.reason
        };
      });
      setCategorizedItems(updatedClassified);
      setStep(3);
      return;
    }

    // Immediately route to step 3 with skeleton placeholders for only the new items
    const initialClassified = allLines.map(text => {
      const existing = existingMap.get(text);
      if (existing) {
        return {
          text,
          source: q1Lines.includes(text) ? 'q1' : q2Lines.includes(text) ? 'q2' : 'q3',
          category: existing.category,
          reason: existing.reason
        };
      }
      return {
        text,
        source: q1Lines.includes(text) ? 'q1' : q2Lines.includes(text) ? 'q2' : 'q3',
        category: 'Classifying...',
        reason: ''
      };
    });

    setCategorizedItems(initialClassified);
    setStep(3);
    setIsClassifying(true);
    setApiError('');

    try {
      const response = await fetch('/api/classify-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToClassify })
      });
      if (!response.ok) throw new Error('Classification service unavailable');
      const data = await response.json();
      if (!data.classifications || !Array.isArray(data.classifications)) {
        throw new Error('Unexpected classification response');
      }

      const newClassifiedMap = new Map(
        data.classifications.map(c => [c.item, c])
      );

      const classified = allLines.map(text => {
        const existing = existingMap.get(text);
        if (existing) {
          return {
            text,
            source: q1Lines.includes(text) ? 'q1' : q2Lines.includes(text) ? 'q2' : 'q3',
            category: existing.category,
            reason: existing.reason
          };
        }
        const match = newClassifiedMap.get(text) || {};
        return {
          text,
          source: q1Lines.includes(text) ? 'q1' : q2Lines.includes(text) ? 'q2' : 'q3',
          category: match.category || 'Uncategorized',
          reason: match.reason || ''
        };
      });
      setCategorizedItems(classified);
    } catch (err) {
      console.error(err);
      setApiError('Classification unavailable – please try again');
      const failedClassified = allLines.map(text => {
        const existing = existingMap.get(text);
        if (existing) {
          return {
            text,
            source: q1Lines.includes(text) ? 'q1' : q2Lines.includes(text) ? 'q2' : 'q3',
            category: existing.category,
            reason: existing.reason
          };
        }
        return {
          text,
          source: q1Lines.includes(text) ? 'q1' : q2Lines.includes(text) ? 'q2' : 'q3',
          category: 'Uncategorized',
          reason: 'Classification failed. You can manually adjust the category.'
        };
      });
      setCategorizedItems(failedClassified);
    } finally {
      setIsClassifying(false);
    }
  };

  const getActiveBuckets = () => {
    const active = new Set();
    categorizedItems.forEach(item => {
      if (item.category !== 'Classifying...') active.add(item.category);
    });
    return Array.from(active);
  };

  const validateItemScoring = () => {
    const errs = {};
    let isValid = true;
    categorizedItems.forEach((item) => {
      const s = itemScoring[item.text] || {};
      const aNum = Number(s.a);
      const bNum = Number(s.b);
      const cNum = Number(s.c);
      errs[item.text] = {};
      if (s.a === undefined || s.a === '' || isNaN(aNum) || aNum < 0) {
        errs[item.text].a = 'Required (≥0)';
        isValid = false;
      }
      if (s.b === undefined || s.b === '' || isNaN(bNum) || bNum < 0) {
        errs[item.text].b = 'Required (≥0)';
        isValid = false;
      }
      if (s.c === undefined || s.c === '' || isNaN(cNum) || cNum < 1 || cNum > 100) {
        errs[item.text].c = 'Required (1–100)';
        isValid = false;
      }
    });
    setItemScoringErrors(errs);
    return isValid;
  };

  const handleClassify = () => {
    if (!validateItemScoring()) return;
    setApiError('');
    try {
      const scoredItems = categorizedItems.map((item) => {
        const s = itemScoring[item.text] || {};
        const A = Number(s.a);
        const B = Number(s.b);
        const C = Number(s.c);
        const score = Math.round(A * B * (C / 100));
        let tier = 'Low Priority';
        if (score >= 300) tier = 'High Priority';
        else if (score >= 100) tier = 'Medium Priority';
        return { ...item, score, tier, A, B, C };
      });

      const rankedItems = [...scoredItems].sort((a, b) => b.score - a.score);

      const bucketResults = {};
      getActiveBuckets().forEach(bucket => {
        const bItems = scoredItems.filter(i => i.category === bucket);
        const totalScore = bItems.reduce((sum, i) => sum + i.score, 0);
        const avgScore = bItems.length ? Math.round(totalScore / bItems.length) : 0;
        let tier = 'Low Priority';
        if (avgScore >= 300) tier = 'High Priority';
        else if (avgScore >= 100) tier = 'Medium Priority';
        bucketResults[bucket] = { score: avgScore, tier, items: bItems.map(i => i.text) };
      });

      setResult({ bucketResults, rankedItems, name, account, categorizedItems });
      setStep(5);

      // Save submission to localStorage (Vercel is stateless — no server filesystem)
      try {
        const existing = JSON.parse(localStorage.getItem('hcl_submissions') || '[]');
        existing.push({
          name,
          account,
          categorizedItems: scoredItems,
          bucketResults,
          answers: { q1: answers.q1, q2: answers.q2, q3: answers.q3 },
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('hcl_submissions', JSON.stringify(existing));
      } catch (e) {
        console.warn('Could not save submission to localStorage:', e);
      }
    } catch (_) {
      setApiError('Classification unavailable – please try again');
    }
  };

  const resetFlow = () => {
    setStep(1);
    setName('');
    setAccount('');
    setAnswers({ q1: '', q2: '', q3: '' });
    setItemScoring({});
    setItemScoringErrors({});
    setCategorizedItems([]);
    setResult(null);
    setApiError('');
  };

  const updateField = (itemText, field, val) => {
    if (val !== '' && Number(val) < 0) return;
    if (field === 'c' && val !== '') {
      const num = Number(val);
      if (num > 100) val = '100';
    }
    setItemScoring(prev => ({ ...prev, [itemText]: { ...(prev[itemText] || {}), [field]: val } }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '20px', maxWidth: step === 1 ? '800px' : '1200px', margin: '0 auto', width: '100%', transition: 'max-width 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
        <img src="/favicon.ico" alt="HCL Logo" style={{ width: '40px', height: '40px', borderRadius: '4px', marginRight: '15px' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>HCL Technologies</h1>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>AI Value Discovery Series</p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ===== STEP 1: Welcome ===== */}
        {step === 1 && (
          <div style={{ backgroundColor: colors.lightGray, color: colors.textDark, borderRadius: '12px', padding: '40px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0, color: colors.primaryBlue }}>Welcome</h2>
            <p>Please enter your details to begin.</p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Your Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #CCC', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Account</label>
              <input
                type="text"
                value={account}
                onChange={e => setAccount(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #CCC', fontSize: '16px', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={!name.trim() || !account.trim()}
              style={{
                backgroundColor: (name.trim() && account.trim()) ? colors.primaryPurple : '#A0AEC0',
                color: colors.white,
                padding: '14px 24px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: (name.trim() && account.trim()) ? 'pointer' : 'not-allowed',
                width: '100%',
                transition: 'background-color 0.3s'
              }}
            >
              Start
            </button>
          </div>
        )}

        {/* ===== STEP 2: Questions ===== */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: colors.lightGray, borderRadius: '12px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '30px' }}>
              {[
                { key: 'q1', label: "What is one thing at work you really don't want to do?" },
                { key: 'q2', label: 'What is taking up too much of your time?' },
                { key: 'q3', label: 'What problem keeps coming up again and again?' }
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', backgroundColor: colors.white, padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                  <label style={{ fontWeight: 'bold', marginBottom: '12px', color: '#6B5B95', fontSize: '18px', display: 'flex', alignItems: 'center', minHeight: '54px' }}>
                    {label}
                  </label>
                  <textarea
                    value={answers[key]}
                    onChange={e => setAnswers(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Enter multiple points, each on a new line"
                    rows={8}
                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '16px', resize: 'vertical', outline: 'none', flex: 1, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleProceedToCategorization}
                style={{
                  backgroundColor: colors.primaryPurple,
                  color: colors.white,
                  padding: '14px 32px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                Continue to Categorize
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: Categorize ===== */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: colors.lightGray, borderRadius: '12px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0, color: colors.primaryBlue }}>Categorize Pain Points</h2>
                <span style={{
                  fontSize: '14px',
                  backgroundColor: '#E2E8F0',
                  color: colors.textDark,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontWeight: 'bold'
                }}>
                  {categorizedItems.length} {categorizedItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              {isClassifying && (
                <div style={{ display: 'flex', alignItems: 'center', color: colors.primaryPurple, fontWeight: 'bold', fontSize: '14px' }}>
                  <svg viewBox="0 0 50 50" style={{ width: '16px', height: '16px', marginRight: '6px', animation: 'spin 1s linear infinite' }}>
                    <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                  AI classifying...
                  <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
              )}
            </div>
            <p style={{ marginTop: 0, marginBottom: '25px', color: '#475569' }}>
              Review how your individual pain points are categorized. Click the pills to manually adjust if needed.
            </p>

            {apiError && (
              <div style={{ color: colors.highRed, marginBottom: '16px', padding: '10px 14px', backgroundColor: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA', fontSize: '13px' }}>
                {apiError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px', maxHeight: '450px', overflowY: 'auto', paddingRight: '10px' }}>
              {categorizedItems.map((item, index) => {
                const isItemLoading = item.category === 'Classifying...';
                const catColor = getCategoryColor(item.category);
                return (
                  <div key={index} style={{
                    backgroundColor: isItemLoading ? colors.white : `${catColor}12`,
                    padding: '16px 20px',
                    borderRadius: '8px',
                    border: `1px solid ${isItemLoading ? '#E2E8F0' : `${catColor}40`}`,
                    borderLeft: `4px solid ${catColor}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: colors.textDark, lineHeight: '1.4', display: 'flex', gap: '8px' }}>
                        <span style={{ color: catColor, fontWeight: '700', flexShrink: 0 }}>{index + 1}.</span>
                        <span>{item.text}</span>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        backgroundColor: isItemLoading ? '#F1F5F9' : `${catColor}20`,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        color: isItemLoading ? '#64748B' : catColor,
                        whiteSpace: 'nowrap',
                        fontWeight: 'bold',
                        border: `1px solid ${isItemLoading ? '#E2E8F0' : `${catColor}50`}`
                      }}>
                        {item.source === 'q1' ? 'Q1: Avoid' : item.source === 'q2' ? 'Q2: Time Sinker' : 'Q3: Recurring'}
                      </span>
                    </div>

                    {isItemLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'pulse-anim 1.5s infinite ease-in-out' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[1, 2, 3].map(i => (
                            <div key={i} style={{ width: '80px', height: '26px', backgroundColor: '#E2E8F0', borderRadius: '16px' }} />
                          ))}
                        </div>
                        <div style={{ width: '60%', height: '14px', backgroundColor: '#E2E8F0', borderRadius: '4px' }} />
                        <style>{`@keyframes pulse-anim { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }`}</style>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: item.reason ? '10px' : '0' }}>
                          {['Automation', 'AI Use Case', 'Process Fix'].map(cat => {
                            const isActive = item.category === cat;
                            const pillColor = getCategoryColor(cat);
                            return (
                              <button
                                key={cat}
                                onClick={() => {
                                  const updated = [...categorizedItems];
                                  updated[index] = { ...updated[index], category: cat, reason: 'Manually categorized.' };
                                  setCategorizedItems(updated);
                                }}
                                style={{
                                  backgroundColor: isActive ? pillColor : colors.white,
                                  color: isActive ? colors.white : '#64748B',
                                  border: `1px solid ${isActive ? pillColor : '#CBD5E1'}`,
                                  padding: '5px 14px',
                                  borderRadius: '16px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  boxShadow: isActive ? `0 2px 6px ${pillColor}60` : 'none'
                                }}
                              >
                                {cat}
                              </button>
                            );
                          })}
                        </div>
                        {item.reason && (
                          <div style={{ fontSize: '12px', color: catColor, fontStyle: 'italic', marginTop: '8px' }}>
                            💡 {item.reason}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setStep(2)}
                style={{ backgroundColor: 'transparent', color: colors.lowGray, border: '1px solid #CBD5E1', padding: '12px 24px', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Back to Questions
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={isClassifying}
                style={{
                  backgroundColor: isClassifying ? '#CBD5E1' : colors.primaryPurple,
                  color: colors.white,
                  padding: '12px 32px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: isClassifying ? 'not-allowed' : 'pointer',
                  boxShadow: isClassifying ? 'none' : '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                Continue to Scoring
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 4: Scoring ===== */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: colors.lightGray, borderRadius: '12px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0, color: colors.primaryBlue, marginBottom: '6px' }}>Score Each Pain Point</h2>
            <p style={{ marginTop: 0, marginBottom: '20px', color: '#475569', fontSize: '14px' }}>
              For every item, define the parameters below. These determine the relative priority of each pain point.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
              {[
                ['A', 'Time Spent (Mins / occurrence)', colors.infoBlue],
                ['B', 'Frequency (Times / week)', colors.successGreen],
                ['C', 'Potential Impact (% time saved: 1–100)', colors.warningOrange]
              ].map(([lbl, desc, col]) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: colors.white, border: `1px solid ${col}50`, borderRadius: '8px', padding: '7px 13px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: col, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>{lbl}</span>
                  <span style={{ fontSize: '13px', color: colors.textDark }}>{desc}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '28px', maxHeight: '520px', overflowY: 'auto', paddingRight: '6px' }}>
              {getActiveBuckets().map(bucket => {
                const bucketColor = getCategoryColor(bucket);
                const bucketItems = categorizedItems.map((item, idx) => ({ item, idx })).filter(({ item }) => item.category === bucket);
                return (
                  <div key={bucket}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: `2px solid ${bucketColor}`, paddingBottom: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: bucketColor, flexShrink: 0 }} />
                      <span style={{ fontWeight: 'bold', fontSize: '15px', color: bucketColor }}>{bucket}</span>
                      <span style={{ fontSize: '12px', color: colors.lowGray }}>({bucketItems.length} item{bucketItems.length !== 1 ? 's' : ''})</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                      {bucketItems.map(({ item, idx }) => {
                        const s = itemScoring[item.text] || {};
                        const errs = itemScoringErrors[item.text] || {};
                        const A = Number(s.a) || 0;
                        const B = Number(s.b) || 0;
                        const C = Number(s.c) || 0;
                        const liveScore = (s.a !== undefined && s.a !== '' && s.b !== undefined && s.b !== '' && s.c !== undefined && s.c !== '') ? Math.round(A * B * (C / 100)) : null;
                        const liveTier = liveScore === null ? null : liveScore >= 300 ? 'High' : liveScore >= 100 ? 'Medium' : 'Low';
                        const tierColor = liveTier === 'High' ? colors.highRed : liveTier === 'Medium' ? colors.mediumYellow : colors.lowGray;

                        return (
                          <div key={idx} style={{ backgroundColor: colors.white, borderRadius: '10px', border: `1px solid ${bucketColor}30`, borderLeft: `4px solid ${bucketColor}`, padding: '14px 16px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textDark, lineHeight: '1.4', flex: 1 }}>{item.text}</span>
                              {liveScore !== null && (
                                <div style={{ textAlign: 'center', minWidth: '56px', flexShrink: 0 }}>
                                  <div style={{ fontSize: '24px', fontWeight: '900', color: tierColor, lineHeight: 1 }}>{liveScore}</div>
                                  <div style={{ fontSize: '10px', color: tierColor, fontWeight: 'bold', marginTop: '2px' }}>{liveTier}</div>
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                              {[
                                ['a', 'A – Mins', errs.a, '0', undefined],
                                ['b', 'B – /week', errs.b, '0', undefined],
                                ['c', 'C – % saved', errs.c, '1', '100']
                              ].map(([field, label, err, minVal, maxVal]) => (
                                <div key={field}>
                                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: colors.lowGray, display: 'block', marginBottom: '3px' }}>{label}</label>
                                  <input
                                    type="number"
                                    min={minVal}
                                    max={maxVal}
                                    value={s[field] ?? ''}
                                    onChange={e => updateField(item.text, field, e.target.value)}
                                    placeholder="–"
                                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: `1px solid ${err ? colors.highRed : '#CBD5E1'}`, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                  {err && <div style={{ color: colors.highRed, fontSize: '10px', marginTop: '2px' }}>{err}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {apiError && <div style={{ color: colors.highRed, marginBottom: '16px', fontWeight: 'bold', textAlign: 'center' }}>{apiError}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(3)} style={{ backgroundColor: 'transparent', color: colors.lowGray, border: '1px solid #CBD5E1', padding: '12px 24px', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                Back to Categorize
              </button>
              <button onClick={handleClassify} style={{ backgroundColor: colors.primaryPurple, color: colors.white, padding: '14px 32px', borderRadius: '6px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                Calculate &amp; Rank
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 5: Results ===== */}
        {step === 5 && result && (
          <div style={{ backgroundColor: colors.lightGray, color: colors.textDark, borderRadius: '12px', padding: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '15px', marginBottom: '25px' }}>
              <div>
                <h3 style={{ margin: 0, color: colors.primaryBlue, fontSize: '22px' }}>{name}</h3>
                <p style={{ margin: '4px 0 0 0', color: colors.lowGray, fontSize: '14px' }}>Account: <strong>{account}</strong></p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#94A3B8', lineHeight: '1.4' }}>
                HCL Technologies<br />AI Value Discovery Series<br />v2.0 | June 2026
              </div>
            </div>

            {/* Rank Order Table */}
            <div style={{ backgroundColor: colors.white, padding: '24px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.03)', marginBottom: '30px' }}>
              <h3 style={{ margin: '0 0 6px 0', color: colors.primaryPurple, fontSize: '17px' }}>🏆 Rank Order</h3>
              <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: colors.lowGray }}>All items sorted by Priority Score — highest impact first.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px 60px 60px 60px 80px 90px', gap: '8px', padding: '8px 12px', backgroundColor: '#F1F5F9', borderRadius: '6px', marginBottom: '8px' }}>
                {['#', 'Rank Order', 'Category', 'A', 'B', 'C%', 'Score', 'Priority'].map(h => (
                  <span key={h} style={{ fontSize: '11px', fontWeight: 'bold', color: colors.lowGray, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                ))}
              </div>

              {result.rankedItems.map((item, rank) => {
                const catColor = getCategoryColor(item.category);
                const tierBg = item.tier === 'High Priority' ? colors.highRed : item.tier === 'Medium Priority' ? colors.mediumYellow : colors.lowGray;
                return (
                  <div key={rank} style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 100px 60px 60px 60px 80px 90px',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    backgroundColor: rank === 0 ? '#FFFBEB' : rank === 1 ? '#F0FFF4' : rank === 2 ? '#EFF6FF' : '#FAFAFA',
                    border: `1px solid ${rank < 3 ? catColor + '30' : '#F1F5F9'}`,
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 'bold', fontSize: '16px', color: rank === 0 ? '#F59E0B' : rank === 1 ? '#9CA3AF' : rank === 2 ? '#CD7F32' : colors.lowGray }}>
                      {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: colors.textDark }}>{item.text}</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: catColor, backgroundColor: `${catColor}15`, padding: '2px 7px', borderRadius: '10px', border: `1px solid ${catColor}30` }}>{item.category}</span>
                    <span style={{ fontSize: '13px', color: colors.textDark, textAlign: 'center' }}>{item.A}</span>
                    <span style={{ fontSize: '13px', color: colors.textDark, textAlign: 'center' }}>{item.B}</span>
                    <span style={{ fontSize: '13px', color: colors.textDark, textAlign: 'center' }}>{item.C}</span>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: tierBg, textAlign: 'center' }}>{item.score}</span>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#fff', backgroundColor: tierBg, padding: '3px 7px', borderRadius: '10px', textAlign: 'center' }}>{item.tier}</span>
                  </div>
                );
              })}
            </div>

            {/* Bucket Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
              {Object.keys(result.bucketResults).map(bucket => {
                const bucketRes = result.bucketResults[bucket];
                const bucketColor = getCategoryColor(bucket);
                return (
                  <div key={bucket} style={{ backgroundColor: colors.white, padding: '20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: bucketColor }} />
                        <h3 style={{ margin: 0, fontSize: '16px', color: colors.textDark }}>{bucket}</h3>
                      </div>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', color: colors.white, fontWeight: 'bold', fontSize: '11px', backgroundColor: bucketRes.tier === 'High Priority' ? colors.highRed : bucketRes.tier === 'Medium Priority' ? colors.mediumYellow : colors.lowGray }}>
                        {bucketRes.tier}
                      </span>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px 0', borderBottom: '1px solid #F1F5F9', borderTop: '1px solid #F1F5F9', marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: colors.lowGray, textTransform: 'uppercase', fontWeight: 'bold' }}>Average Score</div>
                      <div style={{ fontSize: '38px', fontWeight: '900', color: colors.primaryPurple, margin: '4px 0' }}>{bucketRes.score}</div>
                      <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min((bucketRes.score / 500) * 100, 100)}%`, height: '100%', backgroundColor: bucketColor, borderRadius: '3px' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Raw responses */}
            <div style={{ backgroundColor: colors.white, padding: '20px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '22px' }}>
              <h3 style={{ margin: '0 0 14px 0', color: colors.primaryPurple, fontSize: '15px' }}>Original Raw Responses</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                {[['Q1: What to avoid?', answers.q1], ['Q2: Time sinkers?', answers.q2], ['Q3: Recurring issues?', answers.q3]].map(([label, val]) => (
                  <div key={label} style={{ border: '1px solid #E2E8F0', padding: '12px 14px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: colors.lowGray }}>{label}</span>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', marginTop: '6px', color: colors.textDark }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={resetFlow}
              style={{ backgroundColor: 'transparent', color: colors.primaryBlue, border: `2px solid ${colors.primaryBlue}`, padding: '12px 24px', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: 'all 0.2s' }}
              onMouseOver={e => { e.target.style.backgroundColor = colors.primaryBlue; e.target.style.color = colors.white; }}
              onMouseOut={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = colors.primaryBlue; }}
            >
              Start Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
