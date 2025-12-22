import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle, AlertTriangle, Play, RotateCcw, ExternalLink, Activity, Database, Code } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function TestDashboard() {
  const [manualTests, setManualTests] = useState(() => {
    const saved = localStorage.getItem('test_dashboard_manual');
    return saved ? JSON.parse(saved) : {};
  });
  const [autoTests, setAutoTests] = useState({});
  const [runningTests, setRunningTests] = useState(false);

  // Save manual test state to localStorage
  useEffect(() => {
    localStorage.setItem('test_dashboard_manual', JSON.stringify(manualTests));
  }, [manualTests]);

  const toggleManualTest = (id) => {
    setManualTests(prev => ({
      ...prev,
      [id]: {
        completed: !prev[id]?.completed,
        timestamp: new Date().toISOString()
      }
    }));
  };

  const resetManualTests = () => {
    if (confirm('¿Resetear todos los tests manuales?')) {
      setManualTests({});
    }
  };

  // Automated health checks
  const runAutoTests = async () => {
    setRunningTests(true);
    const results = {};

    try {
      // Test 1: API Connectivity
      try {
        await base44.entities.Event.list();
        results.apiConnectivity = { status: 'pass', message: 'API responding' };
      } catch (error) {
        results.apiConnectivity = { status: 'fail', message: error.message };
      }

      // Test 2: Entity Schema Integrity
      try {
        const schemas = await Promise.all([
          base44.entities.Event.schema(),
          base44.entities.Session.schema(),
          base44.entities.Segment.schema(),
          base44.entities.Service.schema(),
        ]);
        const hasRequired = schemas.every(s => s && s.properties);
        results.entitySchemas = { 
          status: hasRequired ? 'pass' : 'fail', 
          message: hasRequired ? 'All schemas valid' : 'Schema validation failed'
        };
      } catch (error) {
        results.entitySchemas = { status: 'fail', message: error.message };
      }

      // Test 3: User Authentication
      try {
        const user = await base44.auth.me();
        results.authentication = { 
          status: user ? 'pass' : 'fail', 
          message: user ? `Logged in as ${user.email}` : 'Not authenticated'
        };
      } catch (error) {
        results.authentication = { status: 'fail', message: error.message };
      }

      // Test 4: Data Integrity (check for orphaned references)
      try {
        const [sessions, segments] = await Promise.all([
          base44.entities.Session.list(),
          base44.entities.Segment.list()
        ]);
        
        const orphanedSegments = segments.filter(seg => 
          seg.session_id && !sessions.some(s => s.id === seg.session_id)
        );
        
        results.dataIntegrity = {
          status: orphanedSegments.length === 0 ? 'pass' : 'warn',
          message: orphanedSegments.length === 0 
            ? 'No orphaned segments' 
            : `${orphanedSegments.length} orphaned segments found`
        };
      } catch (error) {
        results.dataIntegrity = { status: 'fail', message: error.message };
      }

      // Test 5: Autocomplete Suggestions
      try {
        const suggestions = await base44.entities.SuggestionItem.list();
        results.autocomplete = {
          status: 'pass',
          message: `${suggestions.length} suggestions cached`
        };
      } catch (error) {
        results.autocomplete = { status: 'fail', message: error.message };
      }

    } catch (error) {
      results.globalError = { status: 'fail', message: error.message };
    }

    setAutoTests(results);
    setRunningTests(false);
  };

  useEffect(() => {
    runAutoTests();
  }, []);

  const MANUAL_TESTS = [
    {
      id: 'weekly-service-edit',
      category: 'WeeklyServiceManager',
      title: 'Editar segmento y verificar persistencia',
      steps: [
        'Ir a Servicios Dominicales',
        'Seleccionar cualquier domingo',
        'Editar campo "Líder" en Equipo de A&A (9:30am)',
        'Esperar 2 segundos',
        'Refrescar página (F5)',
        '✓ Verificar que el cambio persiste'
      ],
      link: createPageUrl('WeeklyServiceManager')
    },
    {
      id: 'weekly-service-copy',
      category: 'WeeklyServiceManager',
      title: 'Copiar 9:30 → 11:30',
      steps: [
        'Llenar todos los campos de 9:30am',
        'Click "Copiar Todo de 9:30"',
        '✓ Verificar que 11:30am tiene los mismos datos'
      ],
      link: createPageUrl('WeeklyServiceManager')
    },
    {
      id: 'weekly-service-reorder',
      category: 'WeeklyServiceManager',
      title: 'Reordenar segmentos con flechas',
      steps: [
        'Click flecha arriba/abajo en cualquier segmento',
        '✓ Verificar que el segmento cambia de posición',
        'Refrescar página',
        '✓ Verificar que el orden persiste'
      ],
      link: createPageUrl('WeeklyServiceManager')
    },
    {
      id: 'weekly-service-print',
      category: 'WeeklyServiceManager',
      title: 'Imprimir PDF',
      steps: [
        'Click "Configuración de Impresión"',
        'Ajustar escalas',
        'Click icono Imprimir',
        '✓ Verificar que se abre diálogo de impresión',
        '✓ Verificar que ambas páginas se ven correctamente'
      ],
      link: createPageUrl('WeeklyServiceManager')
    },
    {
      id: 'event-create-session-segment',
      category: 'Events',
      title: 'Crear Evento → Sesión → Segmento',
      steps: [
        'Ir a Eventos',
        'Crear nuevo evento de prueba',
        'Abrir el evento',
        'Crear una sesión',
        'Añadir segmento a la sesión',
        'Guardar',
        'Refrescar',
        '✓ Verificar que todo persiste',
        'Eliminar evento de prueba'
      ],
      link: createPageUrl('Events')
    },
    {
      id: 'event-segment-reorder',
      category: 'EventDetail',
      title: 'Reordenar segmentos con flechas',
      steps: [
        'Abrir cualquier evento con sesiones',
        'Expandir una sesión',
        'Click flechas arriba/abajo en segmentos',
        '✓ Verificar que el orden cambia',
        'Refrescar',
        '✓ Verificar persistencia'
      ],
      link: createPageUrl('Events')
    },
    {
      id: 'reports-print-all',
      category: 'Reports',
      title: 'Imprimir todos los informes',
      steps: [
        'Ir a Informes',
        'Seleccionar un evento',
        'Click "Imprimir Todos los Informes"',
        '✓ Verificar que se generan 6 páginas (Detallado, General, Proyección, Sonido, Ujieres, Hospitalidad)'
      ],
      link: createPageUrl('Reports')
    },
    {
      id: 'public-view-countdown',
      category: 'PublicProgramView',
      title: 'Countdown en vivo',
      steps: [
        'Abrir Vista Pública con ?date=YYYY-MM-DD de un servicio con hora definida',
        '✓ Verificar que aparece countdown si está dentro de 2 horas',
        '✓ Verificar que se actualiza cada minuto'
      ],
      link: createPageUrl('PublicProgramView')
    },
    {
      id: 'announcements-crud',
      category: 'Announcements',
      title: 'CRUD de anuncios',
      steps: [
        'Ir a Informes de Anuncios',
        'Crear nuevo anuncio',
        'Editar el anuncio',
        'Verificar que aparece en WeeklyServiceManager',
        'Eliminar el anuncio de prueba'
      ],
      link: createPageUrl('AnnouncementsReport')
    },
    {
      id: 'autocomplete-suggestions',
      category: 'People',
      title: 'Autocomplete en campos',
      steps: [
        'Ir a WeeklyServiceManager o EventDetail',
        'Empezar a escribir nombre en campo "Presentador"',
        '✓ Verificar que aparecen sugerencias',
        'Seleccionar una sugerencia',
        '✓ Verificar que se autocompleta'
      ],
      link: createPageUrl('WeeklyServiceManager')
    },
    {
      id: 'template-apply',
      category: 'Templates',
      title: 'Aplicar plantilla a evento',
      steps: [
        'Ir a Plantillas',
        'Crear plantilla de evento si no existe',
        'Ir a Eventos',
        'Crear nuevo evento desde plantilla',
        '✓ Verificar que sesiones/segmentos se copian',
        'Eliminar evento de prueba'
      ],
      link: createPageUrl('Templates')
    },
    {
      id: 'mobile-responsiveness',
      category: 'UI/UX',
      title: 'Responsive en móvil',
      steps: [
        'Abrir DevTools (F12)',
        'Toggle responsive mode (Ctrl+Shift+M)',
        'Navegar a WeeklyServiceManager, Events, Reports',
        '✓ Verificar que todos los elementos son accesibles',
        '✓ Verificar que no hay overflow horizontal'
      ],
      link: null
    }
  ];

  const categories = [...new Set(MANUAL_TESTS.map(t => t.category))];
  const getCompletedByCategory = (cat) => {
    const tests = MANUAL_TESTS.filter(t => t.category === cat);
    const completed = tests.filter(t => manualTests[t.id]?.completed).length;
    return { completed, total: tests.length };
  };

  const allCompleted = MANUAL_TESTS.every(t => manualTests[t.id]?.completed);
  const totalCompleted = MANUAL_TESTS.filter(t => manualTests[t.id]?.completed).length;

  const getStatusIcon = (status) => {
    if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === 'fail') return <XCircle className="w-5 h-5 text-red-600" />;
    if (status === 'warn') return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <Activity className="w-5 h-5 text-gray-400" />;
  };

  const getStatusColor = (status) => {
    if (status === 'pass') return 'bg-green-100 border-green-300 text-green-800';
    if (status === 'fail') return 'bg-red-100 border-red-300 text-red-800';
    if (status === 'warn') return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-gray-100 border-gray-300 text-gray-600';
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 uppercase tracking-tight font-['Bebas_Neue']">
            Test Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Verifica la salud del sistema antes de lanzar a producción</p>
        </div>
        <Button
          onClick={resetManualTests}
          variant="outline"
          className="border-2 border-gray-400"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset Manual
        </Button>
      </div>

      {/* Overall Status */}
      <Card className={`border-2 ${allCompleted ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Estado General</h2>
              <p className="text-sm text-gray-600 mt-1">
                Tests Manuales: {totalCompleted}/{MANUAL_TESTS.length} completados
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">
                {Math.round((totalCompleted / MANUAL_TESTS.length) * 100)}%
              </div>
              <p className="text-xs text-gray-600">Cobertura</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automated Tests */}
      <Card className="border-2 border-blue-300">
        <CardHeader className="bg-blue-50 border-b-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-600" />
              <CardTitle>Tests Automáticos</CardTitle>
            </div>
            <Button
              onClick={runAutoTests}
              disabled={runningTests}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {runningTests ? (
                <>
                  <Activity className="w-4 h-4 mr-2 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Ejecutar
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {Object.entries(autoTests).map(([key, result]) => (
              <div key={key} className={`flex items-center justify-between p-3 rounded border ${getStatusColor(result.status)}`}>
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <p className="font-semibold">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-xs">{result.message}</p>
                  </div>
                </div>
                <Badge className={result.status === 'pass' ? 'bg-green-600' : result.status === 'fail' ? 'bg-red-600' : 'bg-yellow-600'}>
                  {result.status}
                </Badge>
              </div>
            ))}
            {Object.keys(autoTests).length === 0 && !runningTests && (
              <p className="text-center text-gray-500 py-4">Click "Ejecutar" para correr tests automáticos</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual Tests by Category */}
      {categories.map(category => {
        const tests = MANUAL_TESTS.filter(t => t.category === category);
        const { completed, total } = getCompletedByCategory(category);
        const allCategoryComplete = completed === total;

        return (
          <Card key={category} className={`border-2 ${allCategoryComplete ? 'border-green-300' : 'border-gray-300'}`}>
            <CardHeader className={`border-b-2 ${allCategoryComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-gray-700" />
                  <CardTitle>{category}</CardTitle>
                </div>
                <Badge variant="outline" className={allCategoryComplete ? 'bg-green-100 border-green-400 text-green-800' : ''}>
                  {completed}/{total}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {tests.map(test => {
                  const isCompleted = manualTests[test.id]?.completed;
                  const timestamp = manualTests[test.id]?.timestamp;

                  return (
                    <div key={test.id} className={`p-4 rounded-lg border-2 ${isCompleted ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-white'}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={() => toggleManualTest(test.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-lg">{test.title}</h3>
                            {test.link && (
                              <Link to={test.link}>
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                          <ol className="space-y-1 text-sm text-gray-700 list-decimal list-inside">
                            {test.steps.map((step, idx) => (
                              <li key={idx} className={step.startsWith('✓') ? 'text-blue-600 font-semibold' : ''}>
                                {step}
                              </li>
                            ))}
                          </ol>
                          {isCompleted && timestamp && (
                            <p className="text-xs text-green-700 mt-2">
                              ✓ Completado: {new Date(timestamp).toLocaleString('es-ES')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Known Issues Log */}
      <Card className="border-2 border-red-300">
        <CardHeader className="bg-red-50 border-b-2 border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <CardTitle>Issues Conocidos (Resueltos)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-red-600 text-white flex-shrink-0">FIXED</Badge>
              <div>
                <p className="font-semibold">Drag & Drop en SegmentList roto</p>
                <p className="text-gray-600">Fecha: 2025-12-22 • Causa: Incompatibilidad @hello-pangea/dnd con tablas HTML • Solución: Reemplazado con botones de flecha</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-red-600 text-white flex-shrink-0">FIXED</Badge>
              <div>
                <p className="font-semibold">Drag & Drop en WeeklyServiceManager roto</p>
                <p className="text-gray-600">Fecha: 2025-12-22 • Causa: Misma raíz que SegmentList • Solución: Reemplazado con botones de flecha</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-2 border-blue-300">
        <CardHeader className="bg-blue-50 border-b-2 border-blue-200">
          <CardTitle>Instrucciones de Uso</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3 text-sm">
          <div>
            <p className="font-semibold mb-1">Antes de Lanzar a Producción:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Ejecutar Tests Automáticos - verificar que todos pasen</li>
              <li>Ejecutar Tests Manuales - marcar cada uno al completar</li>
              <li>Si algún test falla, investigar y corregir antes de lanzar</li>
              <li>Documentar cualquier issue nuevo en "Issues Conocidos"</li>
            </ol>
          </div>
          <div className="bg-yellow-50 border border-yellow-300 p-3 rounded">
            <p className="font-semibold text-yellow-900 mb-1">⚠️ Recomendación:</p>
            <p className="text-yellow-800 text-xs">
              Ejecuta este checklist completo cada vez que hayas hecho cambios significativos al código (más de 5 archivos editados o funcionalidades nuevas). Los tests manuales toman ~30min pero previenen horas de debugging en producción.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}