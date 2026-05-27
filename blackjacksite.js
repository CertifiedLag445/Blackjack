class Card {
  constructor(value, suit) {
    this.value = value;
    this.suit = suit;
  }

  toString() {
    const names = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };
    return `${names[this.value] || this.value} of ${this.suit}`;
  }

  getBlackjackValue() {
    if (this.value === 1) return 11;
    return this.value > 10 ? 10 : this.value;
  }
}

class Deck {
  constructor() { this.reset(); }

  reset() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    this.cards = [];
    for (const suit of suits)
      for (let v = 1; v <= 13; v++)
        this.cards.push(new Card(v, suit));
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length < 10) this.reset();
    return this.cards.pop();
  }
}

let stats = { totalGames: 0, wins: 0, losses: 0, pushes: 0 };

function updateStatsDisplay() {
  document.getElementById('totalGames').textContent = stats.totalGames;
  document.getElementById('wins').textContent = stats.wins;
  document.getElementById('losses').textContent = stats.losses;
  document.getElementById('pushes').textContent = stats.pushes;
  const rate = stats.totalGames ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : 0;
  document.getElementById('winRate').textContent = rate;
}

function updateGameStats(gameState) {
  if (gameState.result) {
    stats.totalGames++;
    if (['player_wins', 'blackjack', 'dealer_bust'].includes(gameState.result)) stats.wins++;
    else if (gameState.result === 'push') stats.pushes++;
    else stats.losses++;
  } else if (gameState.multipleResults) {
    gameState.multipleResults.forEach(res => {
      stats.totalGames++;
      if (['player_wins', 'blackjack', 'dealer_bust'].includes(res.result)) stats.wins++;
      else if (res.result === 'push') stats.pushes++;
      else stats.losses++;
    });
  }
  updateStatsDisplay();
}

function updateLiveBetDisplay() {
  const el = document.getElementById('liveBetAmount');
  if (el) el.textContent = game ? (game.currentBet || 0) : 0;
}

class BlackjackGame {
  constructor() {
    this.currency = 10000;
    this.deck = new Deck();
    this.reset();
  }

  reset() {
    this.dealerHand = [];
    this.playerHands = [];
    this.handBets = [];
    this.currentHandIndex = 0;
    this.splitCount = 0;
    this.gameStatus = 'idle';
    this.currentBet = 0;
    this.numHands = 1;
  }

  calculateHand(hand) {
    let total = 0, aces = 0;
    for (const card of hand) {
      const v = card.getBlackjackValue();
      if (v === 11) aces++;
      total += v;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  hasAce(hand) { return hand.some(c => c.value === 1); }

  startNewHand(bet, numHands = 1) {
    if (bet <= 0) throw new Error('Invalid bet amount');
    const totalBet = bet * numHands;
    if (totalBet > this.currency) throw new Error(`Insufficient balance. Need $${totalBet} for ${numHands} hand${numHands > 1 ? 's' : ''}.`);

    this.currency -= totalBet;
    this.numHands = numHands;
    this.currentBet = bet;
    this.currentHandIndex = 0;
    this.splitCount = 0;
    this.gameStatus = 'playing';

    this.playerHands = [];
    this.handBets = [];
    for (let i = 0; i < numHands; i++) {
      this.playerHands.push([this.deck.draw(), this.deck.draw()]);
      this.handBets.push(bet);
    }
    this.dealerHand = [this.deck.draw(), this.deck.draw()];

    const dealerTotal = this.calculateHand(this.dealerHand);
    const results = [];
    let allResolved = true;

    for (let i = 0; i < this.playerHands.length; i++) {
      const pt = this.calculateHand(this.playerHands[i]);
      if (pt === 21 || dealerTotal === 21) {
        results.push({ handIndex: i, ...this.resolveBlackjack(i, pt, dealerTotal) });
      } else {
        allResolved = false;
        results.push(null);
      }
    }

    if (allResolved) {
      this.gameStatus = 'complete';
      return {
        playerHands: this.playerHands,
        dealerHand: this.dealerHand,
        multipleResults: results.map((r, i) => ({
          ...r,
          handIndex: i,
          playerTotal: this.calculateHand(this.playerHands[i]),
          dealerTotal
        })),
        activeHandIndex: null
      };
    }

    while (this.currentHandIndex < this.playerHands.length &&
           results[this.currentHandIndex] !== null) {
      this.currentHandIndex++;
    }

    return {
      playerHands: this.playerHands,
      dealerHand: [this.dealerHand[0], null],
      activeHandIndex: this.currentHandIndex,
      instantResults: results
    };
  }

  resolveBlackjack(handIndex, playerTotal, dealerTotal) {
    const bet = this.handBets[handIndex];
    if (playerTotal === 21 && dealerTotal === 21) {
      this.currency += bet;
      return { result: 'push' };
    } else if (playerTotal === 21) {
      this.currency += Math.floor(bet * 2.5);
      return { result: 'blackjack' };
    } else {
      return { result: 'dealer_blackjack' };
    }
  }

  hit() {
    if (this.gameStatus !== 'playing') throw new Error('Cannot hit: not your turn');
    const hand = this.playerHands[this.currentHandIndex];
    hand.push(this.deck.draw());
    const total = this.calculateHand(hand);

    if (total > 21) {
      if (this.currentHandIndex < this.playerHands.length - 1) {
        const bustedIdx = this.currentHandIndex;
        this.currentHandIndex++;
        return {
          playerHands: this.playerHands,
          dealerHand: [this.dealerHand[0], null],
          activeHandIndex: this.currentHandIndex,
          bustHandIndex: bustedIdx
        };
      } else {
        const anyAlive = this.playerHands.some((h, i) => {
          if (i === this.currentHandIndex) return false;
          return this.calculateHand(h) <= 21;
        });
        if (!anyAlive && this.currentHandIndex === this.playerHands.length - 1) {
          this.gameStatus = 'complete';
          const multipleResults = this.playerHands.map((h, i) => ({
            result: 'bust',
            playerTotal: this.calculateHand(h),
            dealerTotal: this.calculateHand(this.dealerHand),
            handIndex: i
          }));
          return {
            playerHands: this.playerHands,
            dealerHand: this.dealerHand,
            activeHandIndex: this.currentHandIndex,
            bustHandIndex: this.currentHandIndex,
            multipleResults
          };
        }
        this.gameStatus = 'dealer_turn';
        return {
          playerHands: this.playerHands,
          dealerHand: this.dealerHand,
          activeHandIndex: this.currentHandIndex,
          bustHandIndex: this.currentHandIndex,
          needsDealerPlay: true
        };
      }
    }

    return {
      playerHands: this.playerHands,
      dealerHand: [this.dealerHand[0], null],
      activeHandIndex: this.currentHandIndex,
      playerTotal: total
    };
  }

  stand() {
    if (this.gameStatus !== 'playing') throw new Error('Cannot stand: not your turn');

    if (this.currentHandIndex < this.playerHands.length - 1) {
      this.currentHandIndex++;
      return {
        playerHands: this.playerHands,
        dealerHand: [this.dealerHand[0], null],
        activeHandIndex: this.currentHandIndex,
        message: 'next_hand'
      };
    }

    this.gameStatus = 'dealer_turn';
    return {
      playerHands: this.playerHands,
      dealerHand: this.dealerHand,
      activeHandIndex: null,
      message: 'dealer_turn'
    };
  }

  doubleDown() {
    if (this.gameStatus !== 'playing') throw new Error('Cannot double: not your turn');
    const bet = this.handBets[this.currentHandIndex];
    if (this.currency < bet) throw new Error('Insufficient funds to double down.');
    this.currency -= bet;
    this.handBets[this.currentHandIndex] *= 2;
    this.currentBet = this.handBets[this.currentHandIndex];

    const hand = this.playerHands[this.currentHandIndex];
    hand.push(this.deck.draw());
    const total = this.calculateHand(hand);

    if (total > 21) {
      if (this.currentHandIndex < this.playerHands.length - 1) {
        const bustedIdx = this.currentHandIndex;
        this.currentHandIndex++;
        return {
          playerHands: this.playerHands,
          dealerHand: [this.dealerHand[0], null],
          activeHandIndex: this.currentHandIndex,
          bustHandIndex: bustedIdx
        };
      }
      this.gameStatus = 'dealer_turn';
      return {
        playerHands: this.playerHands,
        dealerHand: this.dealerHand,
        activeHandIndex: null,
        bustHandIndex: this.currentHandIndex,
        message: 'dealer_turn'
      };
    }

    return this.stand();
  }

  splitHand() {
    if (this.splitCount >= 3) throw new Error('Maximum splits reached.');
    if (this.gameStatus !== 'playing') throw new Error('Cannot split: not your turn.');
    const hand = this.playerHands[this.currentHandIndex];
    if (hand.length !== 2 || hand[0].getBlackjackValue() !== hand[1].getBlackjackValue())
      throw new Error('Cannot split: hand is not a pair.');
    const bet = this.handBets[this.currentHandIndex];
    if (this.currency < bet) throw new Error('Insufficient funds to split.');

    this.currency -= bet;
    const h1 = [hand[0], this.deck.draw()];
    const h2 = [hand[1], this.deck.draw()];
    this.playerHands.splice(this.currentHandIndex, 1, h1, h2);
    this.handBets.splice(this.currentHandIndex, 1, bet, bet);
    this.splitCount++;

    return {
      playerHands: this.playerHands,
      dealerHand: [this.dealerHand[0], null],
      activeHandIndex: this.currentHandIndex
    };
  }

  dealerNeedsCard() { return this.calculateHand(this.dealerHand) < 17; }
  dealerDrawOneCard() { this.dealerHand.push(this.deck.draw()); }

  finalizeDealerTurn() {
    const dealerTotal = this.calculateHand(this.dealerHand);
    const multipleResults = this.playerHands.map((hand, i) => {
      const playerTotal = this.calculateHand(hand);
      const bet = this.handBets[i];
      let result;
      if (playerTotal > 21) {
        result = 'bust';
      } else if (dealerTotal > 21) {
        result = 'dealer_bust';
        this.currency += bet * 2;
      } else if (playerTotal > dealerTotal) {
        result = 'player_wins';
        this.currency += bet * 2;
      } else if (playerTotal === dealerTotal) {
        result = 'push';
        this.currency += bet;
      } else {
        result = 'dealer_wins';
      }
      return { result, playerTotal, dealerTotal, handIndex: i };
    });
    this.gameStatus = 'complete';
    return {
      playerHands: this.playerHands,
      dealerHand: this.dealerHand,
      multipleResults,
      activeHandIndex: null
    };
  }
}

function renderCardHTML(card, faceUp = true, animate = false) {
  let cardValueName;
  switch (card.value) {
    case 1:  cardValueName = 'ace';   break;
    case 11: cardValueName = 'jack';  break;
    case 12: cardValueName = 'queen'; break;
    case 13: cardValueName = 'king';  break;
    default: cardValueName = card.value;
  }
  const suitName = card.suit.toLowerCase();
  const frontSrc = `BJImages/${cardValueName}_of_${suitName}.png`;
  const backSrc  = 'BJImages/back_of_card.png';
  const enterClass = animate ? 'card-enter' : '';
  return `
    <div class="card-container ${enterClass}">
      <div class="card ${faceUp ? '' : 'is-flipped'}">
        <div class="card-face card-front"><img src="${frontSrc}" alt="${card.toString()}" /></div>
        <div class="card-face card-back"><img src="${backSrc}" alt="Card back" /></div>
      </div>
    </div>`;
}

function animateDrawCard(targetSelector, callback) {
  const deckCard = document.getElementById('deckCard');
  if (!deckCard) { if (callback) callback(); return; }
  const deckRect = deckCard.getBoundingClientRect();
  const clone = deckCard.cloneNode(true);
  clone.id = '';
  clone.style.cssText = `
    position: fixed;
    left: ${deckRect.left}px;
    top: ${deckRect.top}px;
    width: ${deckRect.width}px;
    height: ${deckRect.height}px;
    transition: left 0.38s cubic-bezier(0.22,1,0.36,1), top 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.38s ease;
    z-index: 9999;
    pointer-events: none;
  `;
  document.body.appendChild(clone);
  const targetEl = document.querySelector(targetSelector);
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : deckRect;
  clone.offsetHeight;
  clone.style.left = (targetRect.left + 24) + 'px';
  clone.style.top  = (targetRect.top  + 24) + 'px';
  clone.style.opacity = '0.6';
  clone.addEventListener('transitionend', () => {
    document.body.removeChild(clone);
    if (callback) callback();
  }, { once: true });
}

function flipDealerHiddenCard() {
  const dealerContainers = document.querySelectorAll('#dealerArea .card-container');
  if (dealerContainers.length >= 2) {
    const secondContainer = dealerContainers[1];
    secondContainer.classList.add('card-flip-reveal');
    const cardEl = secondContainer.querySelector('.card');
    if (cardEl) {
      cardEl.classList.remove('is-flipped');
    }
  }
}

function animateInitialDeal(initialState) {
  const playerArea = document.getElementById('playerArea');
  const dealerArea = document.getElementById('dealerArea');
  playerArea.innerHTML = '<h3>Your Hand</h3>';
  dealerArea.innerHTML = '<h3>Dealer\'s Hand</h3>';

  const sequence = [];
  for (let round = 0; round < 2; round++) {
    for (let h = 0; h < game.playerHands.length; h++) {
      sequence.push({ target: '#playerArea' });
    }
    sequence.push({ target: '#dealerArea' });
  }

  let i = 0;
  function dealNext() {
    if (i >= sequence.length) {
      updateUI(initialState);
      return;
    }
    animateDrawCard(sequence[i].target, () => {
      setTimeout(() => { i++; dealNext(); }, 90);
    });
  }
  dealNext();
}

let selectedHandCount = 1;

function selectHandCount(n) {
  selectedHandCount = n;
  document.querySelectorAll('.hand-count-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.count) === n);
  });
}

function updateNavButtons() {
  const calcBtn = document.getElementById('calculatorBtn');
  if (calcBtn) calcBtn.style.display = (game && game.gameStatus === 'playing') ? 'none' : 'inline-block';
}

const resultMessages = {
  bust:             (bet) => `Busted — lost $${bet}.`,
  dealer_bust:      (bet) => `Dealer busted — you won $${bet}!`,
  dealer_wins:      (bet) => `Dealer wins — lost $${bet}.`,
  player_wins:      (bet) => `You win $${bet}!`,
  push:             (bet) => `Push — $${bet} returned.`,
  blackjack:        (bet) => `Blackjack! You won $${Math.floor(bet * 1.5)}!`,
  dealer_blackjack: (bet) => `Dealer Blackjack — lost $${bet}.`
};

function resultClass(result) {
  if (['player_wins', 'blackjack', 'dealer_bust'].includes(result)) return 'result-win';
  if (result === 'push') return 'result-push';
  return 'result-loss';
}

function updateResultInSidebar(html) {
  const sidebarResult = document.getElementById('gameResult-sidebar');
  const mainResult    = document.getElementById('gameResult');
  if (sidebarResult && mainResult) {
    sidebarResult.style.display = html ? 'block' : 'none';
    sidebarResult.innerHTML = html;
    mainResult.innerHTML = '';
  }
}

function updateUI(gameState) {
  if (!gameState) return;
  const playerArea  = document.getElementById('playerArea');
  const dealerArea  = document.getElementById('dealerArea');
  const currencyEl  = document.getElementById('currency');
  const banner      = document.getElementById('activeHandBanner');
  const bannerLabel = document.getElementById('activeHandLabel');

  if (game.playerHands && game.playerHands.length > 0) {
    const activeIdx = gameState.activeHandIndex;
    const handsHtml = game.playerHands.map((hand, idx) => {
      const total    = game.calculateHand(hand);
      const isActive = (activeIdx === idx);
      const busted   = total > 21;
      return `
        <div class="hand-box ${isActive ? 'active-hand-box' : ''}">
          <div class="hand-label">
            <span class="active-indicator"></span>
            Hand ${idx + 1}
          </div>
          ${hand.map(c => renderCardHTML(c, true)).join('')}
          <div class="hand-total">Total: <strong style="color:${busted ? '#e57373' : 'var(--ivory)'};">${total}</strong></div>
          ${busted ? '<div class="hand-bust-label">BUST</div>' : ''}
        </div>`;
    }).join('');

    const isSplit = (game.playerHands.length > game.numHands) || (game.splitCount > 0);
    const handGroupLabel = isSplit
      ? 'Split Hands'
      : (game.playerHands.length > 1 ? `${game.playerHands.length} Hands` : 'Your Hand');

    playerArea.innerHTML = `<h3>${handGroupLabel}</h3><div class="hands-row">${handsHtml}</div>`;

    if (activeIdx !== null && activeIdx !== undefined && game.gameStatus === 'playing') {
      banner.style.display = 'flex';
      bannerLabel.textContent = `Playing Hand ${activeIdx + 1} of ${game.playerHands.length}`;
    } else {
      banner.style.display = 'none';
    }
  }

  if (gameState.dealerHand) {
    const cards = gameState.dealerHand;
    const cardsHtml = cards.map((card, i) => {
      if (!card) return '';
      const faceUp = (i === 0) || (game.gameStatus !== 'playing');
      return renderCardHTML(card, faceUp);
    }).join('');

    let dealerTotal = '';
    if (game.gameStatus !== 'playing' && gameState.dealerTotal !== undefined)
      dealerTotal = ` — ${gameState.dealerTotal}`;
    else if (game.gameStatus !== 'playing')
      dealerTotal = ` — ${game.calculateHand(game.dealerHand)}`;

    dealerArea.innerHTML = `<h3>Dealer's Hand${dealerTotal}</h3>${cardsHtml}`;
  }

  let resultHTML = '';
  if (gameState.multipleResults) {
    const dt = gameState.multipleResults[0] ? gameState.multipleResults[0].dealerTotal : '';
    resultHTML = `<h3>Results</h3>`;
    if (dt !== undefined && dt !== '') resultHTML += `<p>Dealer's Total: <strong>${dt}</strong></p>`;
    gameState.multipleResults.forEach((res, idx) => {
      const bet   = game.handBets[res.handIndex] || game.currentBet;
      const msg   = resultMessages[res.result] ? resultMessages[res.result](bet) : res.result;
      const cls   = resultClass(res.result);
      const label = game.playerHands.length > 1 ? `Hand ${idx + 1}: ` : '';
      resultHTML += `<p>${label}<span class="${cls}">${msg}</span> (Your total: ${res.playerTotal})</p>`;
    });
  } else if (gameState.result) {
    const bet = game.currentBet;
    const msg = resultMessages[gameState.result] ? resultMessages[gameState.result](bet) : gameState.result;
    const cls = resultClass(gameState.result);
    const dt  = gameState.dealerTotal !== undefined ? gameState.dealerTotal : '???';
    const pt  = gameState.playerTotal !== undefined ? gameState.playerTotal : '???';
    resultHTML = `<h3>Result</h3>
      <p><span class="${cls}">${msg}</span></p>
      <p>Dealer: <strong>${dt}</strong> &nbsp;|&nbsp; You: <strong>${pt}</strong></p>`;
  }

  updateResultInSidebar(resultHTML);

  if (currencyEl) currencyEl.textContent = game.currency.toLocaleString();
  updateLiveBetDisplay();
  updateNavButtons();

  const splitBtn = document.getElementById('splitButton');
  if (splitBtn) {
    const currentHand = game.playerHands[game.currentHandIndex];
    const canSplit = currentHand &&
                     currentHand.length === 2 &&
                     currentHand[0].getBlackjackValue() === currentHand[1].getBlackjackValue() &&
                     game.currency >= (game.handBets[game.currentHandIndex] || game.currentBet) &&
                     game.splitCount < 3 &&
                     game.gameStatus === 'playing';
    splitBtn.style.opacity = canSplit ? '1' : '0.45';
  }
}

function animateDealerTurn() {
  if (game.dealerNeedsCard()) {
    animateDrawCard('#dealerArea', () => {
      game.dealerDrawOneCard();
      updateUI({ dealerHand: game.dealerHand, activeHandIndex: null });
      const dealerCards = document.querySelectorAll('#dealerArea .card');
      if (dealerCards.length > 0) {
        const last = dealerCards[dealerCards.length - 1];
        last.classList.add('dealer-card-animate');
        setTimeout(() => last.classList.remove('dealer-card-animate'), 500);
      }
      setTimeout(() => animateDealerTurn(), 380);
    });
  } else {
    const finalState = game.finalizeDealerTurn();
    updateUI(finalState);
    updateGameStats(finalState);
    endHand();
  }
}

function triggerDealerTurn() {
  flipDealerHiddenCard();
  const dealerArea = document.getElementById('dealerArea');
  dealerArea.classList.add('dealer-animate');
  setTimeout(() => dealerArea.classList.remove('dealer-animate'), 500);
  setTimeout(() => {
    updateUI({ dealerHand: game.dealerHand, activeHandIndex: null });
    setTimeout(() => animateDealerTurn(), 400);
  }, 600);
}

let game = null;

function startGame() {
  document.getElementById('playerArea').innerHTML  = '<h3>Your Hand</h3>';
  document.getElementById('dealerArea').innerHTML  = '<h3>Dealer\'s Hand</h3>';
  document.getElementById('activeHandBanner').style.display = 'none';
  updateResultInSidebar('');

  if (!game) {
    game = new BlackjackGame();
  } else {
    game.deck.reset();
    game.reset();
  }

  document.getElementById('gameArea').style.display      = 'block';
  document.getElementById('betArea').style.display       = 'block';
  document.getElementById('actionButtons').style.display = 'none';

  const deckCard = document.getElementById('deckCard');
  if (deckCard) deckCard.innerHTML = `
    <div class="deck-card">
      <div class="card-face card-front"><img src="BJImages/back_of_card.png" alt="Deck" /></div>
      <div class="card-face card-back"><img src="BJImages/back_of_card.png" alt="Deck" /></div>
    </div>`;

  updateNavButtons();
}

function playHand() {
  if (!game) { alert('Please start a new game first.'); return; }
  const betInput = document.getElementById('bet');
  if (!betInput || !betInput.value) { alert('Please enter a bet amount.'); return; }
  const bet = parseInt(betInput.value);
  if (isNaN(bet) || bet <= 0) { alert('Please enter a valid bet.'); return; }

  try {
    const gameState = game.startNewHand(bet, selectedHandCount);
    document.getElementById('actionButtons').style.display = 'flex';
    document.getElementById('betArea').style.display       = 'none';
    updateResultInSidebar('');

    animateInitialDeal(gameState);

    if (gameState.multipleResults) {
      updateGameStats(gameState);
      setTimeout(() => endHand(), 1200);
    }
  } catch (err) { alert(err.message); }
}

function hit() {
  if (!game) { alert('Please start a new game first.'); return; }
  if (game.gameStatus !== 'playing') { alert('Please place a bet to start playing.'); return; }
  try {
    animateDrawCard('#playerArea', () => {
      const state = game.hit();
      updateUI(state);

      if (state.multipleResults) {
        updateGameStats(state);
        endHand();
      } else if (state.needsDealerPlay || state.message === 'dealer_turn') {
        triggerDealerTurn();
      }
    });
  } catch (err) { alert(err.message); }
}

function stand() {
  if (!game) { alert('Please start a new game first.'); return; }
  try {
    const state = game.stand();
    updateUI(state);
    if (state.message === 'dealer_turn' || game.gameStatus === 'dealer_turn') {
      triggerDealerTurn();
    }
  } catch (err) { alert(err.message); }
}

function handleDoubleDown() {
  if (!game) { alert('Please start a new game first.'); return; }
  try {
    animateDrawCard('#playerArea', () => {
      const state = game.doubleDown();
      updateUI(state);
      if (state.message === 'dealer_turn' || game.gameStatus === 'dealer_turn') {
        triggerDealerTurn();
      } else if (state.multipleResults) {
        updateGameStats(state);
        endHand();
      }
    });
  } catch (err) { alert(err.message); }
}

function handleSplit() {
  if (!game) { alert('Please start a new game first.'); return; }
  try {
    const state = game.splitHand();
    updateUI(state);
  } catch (err) { alert(err.message); }
}

function endHand() {
  document.getElementById('actionButtons').style.display = 'none';
  document.getElementById('betArea').style.display       = 'block';
  document.getElementById('activeHandBanner').style.display = 'none';

  if (game) { game.splitCount = 0; game.numHands = selectedHandCount; }

  updateNavButtons();
}

function getPairStrategy(cardValue, dealerCard) {
  if (cardValue === 11) return { move: 'split', details: 'Always split Aces.' };
  if (cardValue === 10) return { move: 'stand', details: 'Never split 10s.' };
  if (cardValue === 9) return (dealerCard === 7 || dealerCard >= 10)
    ? { move: 'stand', details: `Stand on pair of 9s vs dealer ${dealerCard}.` }
    : { move: 'split', details: `Split 9s vs dealer ${dealerCard}.` };
  if (cardValue === 8) return { move: 'split', details: 'Always split 8s.' };
  if (cardValue === 7) return dealerCard <= 7
    ? { move: 'split', details: `Split 7s vs dealer ${dealerCard}.` }
    : { move: 'hit',   details: `Hit on pair of 7s vs dealer ${dealerCard}.` };
  if (cardValue === 6) return dealerCard <= 6
    ? { move: 'split', details: `Split 6s vs dealer ${dealerCard}.` }
    : { move: 'hit',   details: `Hit on 6s vs dealer ${dealerCard}.` };
  if (cardValue === 5) return dealerCard <= 9
    ? { move: 'double', details: 'Double on pair of 5s.' }
    : { move: 'hit',    details: `Hit on pair of 5s vs dealer ${dealerCard}.` };
  if (cardValue === 4) return (dealerCard === 5 || dealerCard === 6)
    ? { move: 'split', details: `Split 4s vs dealer ${dealerCard}.` }
    : { move: 'hit',   details: `Hit on pair of 4s vs dealer ${dealerCard}.` };
  if (cardValue <= 3) return dealerCard <= 7
    ? { move: 'split', details: `Split ${cardValue}s vs dealer ${dealerCard}.` }
    : { move: 'hit',   details: `Hit on pair of ${cardValue}s vs dealer ${dealerCard}.` };
  return { move: 'hit', details: 'Hit by default.' };
}

function getSoftTotalStrategy(total, dealerCard) {
  if (total >= 19) return { move: (total === 19 && dealerCard === 6) ? 'double' : 'stand',
    details: `Soft ${total} is strong — ${total === 19 && dealerCard === 6 ? 'double vs dealer 6' : 'stand'}.` };
  if (total === 18) {
    if (dealerCard >= 9) return { move: 'hit',    details: `Hit soft 18 vs dealer ${dealerCard}.` };
    if (dealerCard >= 7) return { move: 'stand',  details: `Stand soft 18 vs dealer ${dealerCard}.` };
    return                      { move: 'double', details: `Double soft 18 vs dealer ${dealerCard}.` };
  }
  if (total === 17) return (dealerCard >= 3 && dealerCard <= 6)
    ? { move: 'double', details: 'Double soft 17.' }
    : { move: 'hit',    details: 'Hit soft 17.' };
  return (dealerCard >= 4 && dealerCard <= 6)
    ? { move: 'double', details: `Double soft ${total}.` }
    : { move: 'hit',    details: `Hit soft ${total}.` };
}

function getHardTotalStrategy(total, dealerCard) {
  if (total >= 17) return { move: 'stand', details: `Hard ${total} — stand.` };
  if (total >= 13) return dealerCard >= 7
    ? { move: 'hit',   details: `Hit hard ${total} vs dealer ${dealerCard}.` }
    : { move: 'stand', details: `Stand hard ${total} vs dealer ${dealerCard}.` };
  if (total === 12) return (dealerCard >= 4 && dealerCard <= 6)
    ? { move: 'stand', details: 'Stand hard 12.' }
    : { move: 'hit',   details: 'Hit hard 12.' };
  if (total === 11) return { move: 'double', details: 'Double on hard 11.' };
  if (total === 10) return dealerCard >= 10
    ? { move: 'hit',    details: 'Hit hard 10 vs dealer 10/A.' }
    : { move: 'double', details: 'Double hard 10.' };
  if (total === 9) return (dealerCard >= 3 && dealerCard <= 6)
    ? { move: 'double', details: 'Double hard 9.' }
    : { move: 'hit',    details: 'Hit hard 9.' };
  return { move: 'hit', details: `Hit hard ${total}.` };
}

function getStrategyHTML(move, handType, details) {
  const colors = { hit: '#e57373', stand: '#6dce8a', double: '#f0cc6a', split: '#64b5f6' };
  const labels = { hit: 'Take another card', stand: 'Keep your current hand',
                   double: 'Double bet, take one card', split: 'Split into two hands' };
  return `
    <div>
      <h3>Recommendation</h3>
      <p style="color:var(--ivory-dim); margin:4px 0;">Hand Type: <strong style="color:var(--ivory);">${handType}</strong></p>
      <p style="margin:12px 0 6px;">Move:
        <span style="color:${colors[move]};font-weight:700;font-size:1.2rem;letter-spacing:0.06em;text-transform:uppercase;">${move}</span>
      </p>
      <p style="color:var(--ivory-dim);font-size:0.95rem;">${labels[move]}</p>
      ${details ? `<p style="font-size:0.85rem;color:var(--gold-dim);margin-top:10px;">&#x2139; ${details}</p>` : ''}
    </div>`;
}

function calculateBestMove() {
  const c1 = parseInt(document.getElementById('playerCard1').value);
  const c2 = parseInt(document.getElementById('playerCard2').value);
  const dc = parseInt(document.getElementById('dealerCard').value);
  const el = document.getElementById('bestMove');
  if (!c1 || !c2 || !dc) { el.innerHTML = '<p style="color:#e57373;">Please select all three cards.</p>'; return; }
  let total = c1 + c2;
  const hasAce = (c1 === 11 || c2 === 11);
  if (c1 === c2) {
    const { move, details } = getPairStrategy(c1, dc);
    el.innerHTML = getStrategyHTML(move, `Pair of ${c1 === 11 ? 'Aces' : c1 + 's'}`, details);
    return;
  }
  if (hasAce) {
    if (total > 21) total -= 10;
    const { move, details } = getSoftTotalStrategy(total, dc);
    el.innerHTML = getStrategyHTML(move, `Soft ${total}`, details);
    return;
  }
  const { move, details } = getHardTotalStrategy(total, dc);
  el.innerHTML = getStrategyHTML(move, `Hard ${total}`, details);
}

function updatePlayerTotal() {
  const c1 = parseInt(document.getElementById('playerCard1').value);
  const c2 = parseInt(document.getElementById('playerCard2').value);
  const dc = parseInt(document.getElementById('dealerCard').value);
  if (c1 && c2 && dc) calculateBestMove();
}

function showTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
  document.getElementById(tabName).style.display = 'block';

  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(tabName === 'game' ? 'gameTabBtn' : 'calculatorBtn').classList.add('active');

  const bjRules = document.getElementById('blackjackRulesContainer');
  const stRules = document.getElementById('strategyRulesContainer');

  if (tabName === 'game') {
    if (bjRules) bjRules.style.display = 'block';
    if (stRules) stRules.style.display = 'none';
  } else {
    if (bjRules) bjRules.style.display = 'none';
    if (stRules) stRules.style.display = 'block';
    document.getElementById('playerCard1').value = '';
    document.getElementById('playerCard2').value = '';
    document.getElementById('dealerCard').value  = '';
    document.getElementById('bestMove').innerHTML = '';
  }
}
