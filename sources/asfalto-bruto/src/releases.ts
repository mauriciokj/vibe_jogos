import './releases.css';
import { GAME_VERSION } from './version';
export { GAME_VERSION } from './version';
export const RELEASES=[
  {version:GAME_VERSION,date:'10/09/2026',title:'Prisão, resultados e obras na pista',changes:[
    'A câmera da próxima corrida começa na largada, mesmo após uma queda e uma espera pelo servidor.',
    'O campeonato explica quando a corrida termina por prisão, moto quebrada, explosão, abandono ou tempo esgotado. O motivo fica salvo junto aos pontos.',
    'Ao ser preso, a câmera se afasta e o policial desce da moto para algemar o piloto antes de mostrar o resultado. Os outros jogadores online continuam correndo.',
    'Trabalhadores nas obras do Porto Ferrugem e sinalizadores com placa de PARE junto ao primeiro carro das filas nos dois sentidos.'
  ]},
  {version:'1.1.1-beta',date:'10/09/2026',title:'Menu mais compacto',changes:[
    'Título, campeonato e cartões de pistas ajustados à altura da tela para o menu caber no computador e no celular.',
    'Seleção de pistas ao lado dos modos de jogo no celular deitado. Versão, novidades e contador de visitantes reunidos no rodapé.'
  ]},
  {version:'1.1.0-beta',date:'10/09/2026',title:'Sua garagem protegida',changes:[
    'Créditos, compras, reparos e equipamentos da conta passam a ser confirmados pelo servidor.',
    'Corridas individuais e do campeonato são conferidas antes de conceder prêmios. O progresso das contas do beta foi preservado.',
    'O multiplayer consulta os equipamentos da conta e controla as cargas de nitro.',
    'Versão visível no menu e histórico de atualizações acessível em um toque.'
  ]},
  {version:'ddfdb19',date:'09/09/2026',title:'Quedas com recuperação a pé',changes:['Piloto e moto deslizam separadamente conforme a velocidade. Corra para frente, para trás e para os lados até a moto para voltar à corrida.','Atropelamentos causam dano e atrasam a recuperação; motos caídas viram rampas. A polícia pode prender o piloto a pé.','Moto com integridade zero explode ao tentar levantá-la. Câmera acompanha a queda suavemente, com corpo em perspectiva e corrida a pé animada.','Nova classificação de tempos para esta física, preservando o histórico anterior.']},
  {version:'eb921e0',date:'09/09/2026',title:'Largada e polícia na chegada',changes:['Correção de adversários que ficavam parados com a moto quebrada na largada.','Policiais que alcançam a chegada descem da moto e atacam os pilotos próximos.']},
  {version:'ec57358',date:'09/09/2026',title:'Reparos no campeonato',changes:['Moto zerada pode ser reparada entre corridas da mesma etapa. A largada é bloqueada com integridade zero.','Aviso quando a integridade fica abaixo de 20%.']},
  {version:'b795b2c',date:'09/09/2026',title:'Troféu no menu',changes:['Campeonato ganha cartão com troféu e indicação da etapa para retomar.']},
  {version:'881cdc3',date:'09/09/2026',title:'Modo campeonato',changes:['Cinco etapas com quatro corridas cada: dia, entardecer, noite e chuva.','Os seis primeiros pontuam 10, 6, 4, 3, 2 e 1. Termine a etapa entre os três primeiros para avançar.','Classificação entre corridas, integridade acumulada e retomada do campeonato. Eliminação exige começar novamente.']},
  {version:'b636d1e',date:'09/09/2026',title:'Mais obstáculos na estrada',changes:['Árvores caídas na Serra da Fumaça; feno e tatus no Vale Vermelho.','Filas de carros parados nos dois sentidos em obras do Porto Ferrugem.','Rampas de terra e lenha na Terra Brava. Moto policial mais veloz.']},
  {version:'8dd9de2',date:'09/09/2026',title:'Próxima corrida na ordem certa',changes:['Avance pelas quatro condições da mesma estrada antes de seguir para a próxima pista.']},
  {version:'1a83e16',date:'09/09/2026',title:'Todos param na chegada',changes:['Correção dos pilotos que continuavam andando após cruzar a linha.']},
  {version:'ce09761',date:'09/09/2026',title:'Prêmio por recorde pessoal',changes:['Bater seu recorde de tempo concede bônus de 30% do prêmio da pista.']},
  {version:'3f98044',date:'09/09/2026',title:'Uma chegada para comemorar',changes:['Carros e público aguardam na chegada. O vencedor ergue os braços e a câmera recua antes dos resultados.','Opções para próxima corrida, repetir ou voltar ao menu.']},
  {version:'3510830',date:'09/09/2026',title:'Mais visão da pista',changes:['Nome da pista e condição abaixo do minimapa; tempo, retrovisor e avisos reposicionados.','Polícia pisca em vermelho e azul no minimapa.']},
  {version:'b1f6295',date:'09/09/2026',title:'Ajuste no login Google',changes:['Correção ao voltar da janela de login para o jogo.']},
  {version:'256c6c1',date:'09/09/2026',title:'Conta e ranking permanente',changes:['Conta Google para levar garagem e progresso entre dispositivos.','Rankings separados para individual e multiplayer, por pista e condição.','Resultados individuais conferidos por reprodução dos comandos da corrida.']},
  {version:'adda59c',date:'09/09/2026',title:'Recuperação da conexão',changes:['Reconexão quando os pilotos online deixam de receber atualizações.']},
  {version:'2e39891',date:'09/09/2026',title:'Partidas públicas',changes:['Encontre salas sem código. Salas públicas aguardam 120 segundos; todos prontos reduzem a espera para cinco.']},
  {version:'d6ccbaf',date:'09/09/2026',title:'Rivais mais rápidos',changes:['Novo aumento no ritmo dos adversários controlados pelo jogo.']},
  {version:'1aaf6b2',date:'09/09/2026',title:'Joelho na chuva',changes:['Escorregão após mais de dois segundos com o joelho apoiado na chuva.']},
  {version:'1dad6e4',date:'09/09/2026',title:'Corridas mais disputadas',changes:['Adversários mais competitivos, com uso da joelheira e ajustes na dificuldade.']},
  {version:'03f1799',date:'09/09/2026',title:'Terra Brava',changes:['Estrada rural de duas faixas, chão de terra, subidas, descidas, barrancos e tratores.']},
  {version:'3618af7',date:'09/09/2026',title:'Capacetes personalizados',changes:['Modelos compráveis com créditos e cores gratuitas na garagem.']},
  {version:'8e20908',date:'09/09/2026',title:'Som dos guard rails',changes:['Impacto metálico e raspagem ao encostar nas proteções.']},
  {version:'a5f4c90',date:'08/09/2026',title:'Proteções com colisão',changes:['Guard rails impedem atravessar a lateral e reduzem a velocidade, sem derrubar automaticamente.']},
  {version:'dace3a5',date:'08/09/2026',title:'Saltos com mais impacto',changes:['Som metálico ao saltar carros e motor acelerando enquanto a roda está no ar.']},
  {version:'6d6ee04',date:'08/09/2026',title:'Contador de visitantes',changes:['O menu mostra quantas pessoas já tentaram a sorte no jogo.']},
  {version:'782ee62',date:'08/09/2026',title:'Tolerância ao joelho na chuva',changes:['A queda deixa de ser imediata e passa a depender do tempo de apoio. Ajustada depois para dois segundos.']},
  {version:'2f109cc',date:'08/09/2026',title:'Menos mensagens durante a corrida',changes:['Removidos os avisos repetidos sobre comprar joelheira e velocidade mínima das manobras.']},
  {version:'feb576d',date:'08/09/2026',title:'Porto Ferrugem e economia',changes:['Pista industrial com obras e easter egg visual do passageiro pendurado no caminhão.','Motos mais caras: a segunda começa em 10 mil créditos, e a mais potente chega à faixa dos 100 mil.']},
  {version:'46feaaf',date:'08/09/2026',title:'Empinadas e armas permanentes',changes:['Dois toques no acelerador empinam a moto. São três usos por corrida para saltar carros na contramão, sem saltar caminhões.','Corrente, bastão de beisebol e garrafa compráveis na garagem, com danos diferentes e posse permanente.']},
  {version:'8730918',date:'08/09/2026',title:'Joelheiras, nitro e controles',changes:['Joelheiras de várias cores melhoram curvas: dois toques na direção ativam o joelho no chão; choppers não fazem a manobra.','Nitro comprável, com 10% de potência extra e capacidade diferente para cada moto.','Buzina, provocações em balões e controles analógicos para celular.']},
  {version:'3c14dac',date:'08/09/2026',title:'Condições como pistas',changes:['Dia, entardecer, noite e chuva aparecem como opções próprias na seleção de pistas. Correção de sobreposição no menu.']},
  {version:'8bd0b85',date:'08/09/2026',title:'Clima, iluminação e segredos',changes:['Dia, entardecer, noite e chuva transformam as estradas; chuva muda a aderência.','Easter eggs visuais, incluindo uma sereia que pode aparecer no mar da Costa do Sol.']},
  {version:'1f03611',date:'08/09/2026',title:'Os jogos na mesma casa',changes:['Jogo e multiplayer passam a rodar na VPS, com acesso pelo domínio próprio.']},
  {version:'9618377',date:'08/09/2026',title:'Motos com personalidades diferentes',changes:['Modelos esportivos e chopper, com velocidade, resistência e agilidade próprias.','Escolha de moto no multiplayer.']},
  {version:'a51beed',date:'08/09/2026',title:'Instrumentos consistentes',changes:['Ajustes no minimapa e retrovisor durante a corrida.']},
  {version:'f9adff3',date:'08/09/2026',title:'Curvas, bots e instrumentos',changes:['Curvas que exigem frear, opção de preencher salas com bots, minimapa com distâncias e retrovisor.']},
  {version:'d73608d',date:'08/09/2026',title:'Comandos online mais ágeis',changes:['Envio imediato dos controles e menos viagens ao serviço de dados usado na primeira versão online.']},
  {version:'a45c11e',date:'08/09/2026',title:'Ajustes de latência',changes:['Primeira hospedagem multiplayer direcionada para São Paulo e medição do tempo de resposta.']},
  {version:'82d5f4f',date:'08/09/2026',title:'Combate e movimento online',changes:['Correções dos saltos de posição e dos golpes rápidos no multiplayer.']},
  {version:'a99331e',date:'07/09/2026',title:'Primeiro beta e multiplayer',changes:['Corridas arcade de motos com combate, tráfego, polícia, garagem, reparos e melhorias.','Multiplayer opcional para duas a oito pessoas, com salas por código e botão pronto. O modo individual continua disponível.']}
];

export function releaseUI(){
  const button=document.createElement('button');button.id='version-btn';button.textContent=`BETA ${GAME_VERSION.replace('-beta','')} · NOVIDADES ↗`;
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','releases-modal');
  document.querySelector('#menu .bottomline')!.prepend(button);
  const modal=document.createElement('dialog');modal.id='releases-modal';modal.setAttribute('aria-labelledby','releases-title');
  modal.innerHTML=`<div class="dialog-header"><div><div class="eyebrow">ASFALTO BRUTO · EM DESENVOLVIMENTO</div><h2 id="releases-title">O que mudou</h2></div><button class="close-btn" aria-label="Fechar novidades">×</button></div><div class="dialog-body release-list"><p>Estamos no beta. A estrada continua crescendo a cada atualização.</p>${RELEASES.map((r,i)=>`<details ${i===0?'open':''}><summary><span class="release-meta">${i===0?'VERSÃO '+r.version:'REVISÃO '+r.version} · ${r.date}${i===0?' · ATUAL':''}</span><strong>${r.title}</strong></summary><ul>${r.changes.map(c=>`<li>${c}</li>`).join('')}</ul></details>`).join('')}<p class="release-footnote">Antes da versão 1.1.0, as atualizações não tinham numeração própria na tela. As revisões identificam essas publicações anteriores.</p></div>`;
  document.body.append(modal);
  button.addEventListener('click',()=>{modal.showModal();modal.scrollTop=0;});
  modal.querySelector('button')!.addEventListener('click',()=>modal.close());
  modal.addEventListener('close',()=>button.focus({preventScroll:true}));
}
