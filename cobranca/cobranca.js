angular.module('cobrancaApp', ['snk']).controller('cobrancaController', ['ServiceProxy', 'MessageUtils',
   function(ServiceProxy, MessageUtils) {
      var self = this;

      // ===================================================================
      // DADOS FICTÍCIOS (validação de layout).
      // Na versão real, vêm do Sankhya:
      //   - cliente  -> CRUDServiceProvider.loadRecords (entidade Parceiro)
      //   - titulos  -> DbExplorerSP.executeQuery (TGFFIN, com dias/juros)
      // ===================================================================
      self.cliente = {
         nome: 'Comercial Silva & Andrade Ltda',
         cnpj: '12.345.678/0001-90',
         codparc: 4821,
         representante: 'Marcos Vinícius',
         status: { label: 'Em atraso', cls: 'atraso' },
         cidade: 'São Paulo / SP',
         contatos: {
            telefone: '(11) 3555-1020',
            celular: '(11) 98877-4433',
            email: 'financeiro@silvaandrade.com.br'
         },
         limite: { total: 150000, usado: 117000 },
         pontualidade: 62,
         score: 41
      };

      self.titulos = [
         { id: '#100482', venc: '15/04/2026', dias: 80, tipo: 'vencidos', original: 18500, juros: 1924 },
         { id: '#100655', venc: '10/05/2026', dias: 55, tipo: 'vencidos', original: 12300, juros: 880 },
         { id: '#100901', venc: '20/06/2026', dias: 14, tipo: 'vencidos', original: 9100,  juros: 166 },
         { id: '#101120', venc: '18/07/2026', dias: 0,  tipo: 'avencer',  original: 5850,  juros: 0 }
      ];

      self.anexos = [
         { tipo: 'PDF', nome: 'Acordo_parcelamento_v2.pdf',       meta: '240 KB · anexado em 01/07/2026' },
         { tipo: 'JPG', nome: 'Comprovante_entrega_NF8842.jpg',   meta: '1,1 MB · anexado em 22/06/2026' }
      ];

      self.chamadas = [
         { ordem: 1, cls: 'done',    icon: '✓', data: '28/06', status: 'Atendeu' },
         { ordem: 2, cls: 'done',    icon: '✓', data: '01/07', status: 'Agendou retorno' },
         { ordem: 3, cls: 'current', icon: '3',      data: 'pendente', status: '' }
      ];

      // ---- estado da UI ----
      self.filtro = 'todos';
      self.titulosFiltrados = [];
      self.totais = {};

      // ---- API pro template ----
      self.brl = brl;
      self.setFiltro = setFiltro;
      self.atual = function(t) { return t.original + t.juros; };
      self.pctLimite = function() { return Math.round(self.cliente.limite.usado / self.cliente.limite.total * 100); };
      self.contagem = { todos: 4, vencidos: 3, avencer: 1 };

      setFiltro('todos');

      function setFiltro(f) {
         self.filtro = f;
         self.titulosFiltrados = self.titulos.filter(function(t) {
            return f === 'todos' || t.tipo === f;
         });
         recompute();
      }

      function recompute() {
         var o = 0, j = 0;
         self.titulosFiltrados.forEach(function(t) { o += t.original; j += t.juros; });
         self.totais = { count: self.titulosFiltrados.length, original: o, juros: j, total: o + j };
      }

      function brl(n) {
         return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      // Placeholder das ações — implementar na Fase 2/3
      self.registrarChamada = function() {
         MessageUtils.showInfo('Registrar chamada', 'Pop-up de registro será implementado na Fase 2.');
      };
   }
]);
