export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      acuerdos: {
        Row: {
          comunidad_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_acuerdo"]
          fecha_limite: string | null
          id: string
          junta_id: string | null
          punto_id: string | null
          responsable_id: string | null
          texto: string
        }
        Insert: {
          comunidad_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_acuerdo"]
          fecha_limite?: string | null
          id?: string
          junta_id?: string | null
          punto_id?: string | null
          responsable_id?: string | null
          texto: string
        }
        Update: {
          comunidad_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_acuerdo"]
          fecha_limite?: string | null
          id?: string
          junta_id?: string | null
          punto_id?: string | null
          responsable_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "acuerdos_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acuerdos_junta_id_fkey"
            columns: ["junta_id"]
            isOneToOne: false
            referencedRelation: "juntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acuerdos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_del_dia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acuerdos_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anuncios: {
        Row: {
          autor_id: string | null
          caduca_en: string | null
          comunidad_id: string
          contenido: string
          creado_en: string
          fijado: boolean
          id: string
          publicado_en: string
          titulo: string
        }
        Insert: {
          autor_id?: string | null
          caduca_en?: string | null
          comunidad_id: string
          contenido: string
          creado_en?: string
          fijado?: boolean
          id?: string
          publicado_en?: string
          titulo: string
        }
        Update: {
          autor_id?: string | null
          caduca_en?: string | null
          comunidad_id?: string
          contenido?: string
          creado_en?: string
          fijado?: boolean
          id?: string
          publicado_en?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "anuncios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anuncios_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      asistencias: {
        Row: {
          coeficiente: number
          creado_en: string
          finca_id: string
          id: string
          junta_id: string
          modo: Database["public"]["Enums"]["modo_asistencia"]
          registrado_por: string | null
          representado_por: string | null
          representante_nombre: string | null
          usuario_id: string | null
        }
        Insert: {
          coeficiente?: number
          creado_en?: string
          finca_id: string
          id?: string
          junta_id: string
          modo?: Database["public"]["Enums"]["modo_asistencia"]
          registrado_por?: string | null
          representado_por?: string | null
          representante_nombre?: string | null
          usuario_id?: string | null
        }
        Update: {
          coeficiente?: number
          creado_en?: string
          finca_id?: string
          id?: string
          junta_id?: string
          modo?: Database["public"]["Enums"]["modo_asistencia"]
          registrado_por?: string | null
          representado_por?: string | null
          representante_nombre?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencias_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencias_junta_id_fkey"
            columns: ["junta_id"]
            isOneToOne: false
            referencedRelation: "juntas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencias_representado_por_fkey"
            columns: ["representado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencias_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          comunidad_id: string | null
          creado_en: string
          datos: Json | null
          entidad: string
          entidad_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          comunidad_id?: string | null
          creado_en?: string
          datos?: Json | null
          entidad: string
          entidad_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          comunidad_id?: string | null
          creado_en?: string
          datos?: Json | null
          entidad?: string
          entidad_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_gasto: {
        Row: {
          comunidad_id: string
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          comunidad_id: string
          id?: string
          nombre: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          comunidad_id?: string
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "categorias_gasto_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      comunidades: {
        Row: {
          actualizado_en: string
          administrador_correo: string | null
          administrador_nombre: string | null
          administrador_telefono: string | null
          anio_construccion: number | null
          cif: string | null
          ciudad: string | null
          codigo_postal: string | null
          coeficiente_total: number
          creado_en: string
          cuota_mensual: number
          saldo_inicial: number
          saldo_inicial_fecha: string | null
          direccion: string | null
          iban: string | null
          id: string
          nombre: string
          numero_casas: number
          numero_pisos: number
          provincia: string | null
        }
        Insert: {
          actualizado_en?: string
          administrador_correo?: string | null
          administrador_nombre?: string | null
          administrador_telefono?: string | null
          anio_construccion?: number | null
          cif?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          coeficiente_total?: number
          creado_en?: string
          cuota_mensual?: number
          saldo_inicial?: number
          saldo_inicial_fecha?: string | null
          direccion?: string | null
          iban?: string | null
          id?: string
          nombre: string
          numero_casas?: number
          numero_pisos?: number
          provincia?: string | null
        }
        Update: {
          actualizado_en?: string
          administrador_correo?: string | null
          administrador_nombre?: string | null
          administrador_telefono?: string | null
          anio_construccion?: number | null
          cif?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          coeficiente_total?: number
          creado_en?: string
          cuota_mensual?: number
          saldo_inicial?: number
          saldo_inicial_fecha?: string | null
          direccion?: string | null
          iban?: string | null
          id?: string
          nombre?: string
          numero_casas?: number
          numero_pisos?: number
          provincia?: string | null
        }
        Relationships: []
      }
      documentos: {
        Row: {
          caduca_en: string | null
          carpeta: string
          comunidad_id: string
          creado_en: string
          descripcion: string | null
          id: string
          nombre: string
          ruta_almacenamiento: string | null
          subido_por: string | null
          tamano_bytes: number | null
          tipo_mime: string | null
          visible_para: Database["public"]["Enums"]["rol_miembro"][] | null
        }
        Insert: {
          caduca_en?: string | null
          carpeta?: string
          comunidad_id: string
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre: string
          ruta_almacenamiento?: string | null
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo_mime?: string | null
          visible_para?: Database["public"]["Enums"]["rol_miembro"][] | null
        }
        Update: {
          caduca_en?: string | null
          carpeta?: string
          comunidad_id?: string
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          ruta_almacenamiento?: string | null
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo_mime?: string | null
          visible_para?: Database["public"]["Enums"]["rol_miembro"][] | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fincas: {
        Row: {
          actualizado_en: string
          codigo: string
          coeficiente: number
          comunidad_id: string
          creado_en: string
          id: string
          metros_cuadrados: number | null
          notas: string | null
          numero: number | null
          planta: string | null
          puerta: string | null
          tipo: Database["public"]["Enums"]["tipo_finca"]
        }
        Insert: {
          actualizado_en?: string
          codigo: string
          coeficiente?: number
          comunidad_id: string
          creado_en?: string
          id?: string
          metros_cuadrados?: number | null
          notas?: string | null
          numero?: number | null
          planta?: string | null
          puerta?: string | null
          tipo?: Database["public"]["Enums"]["tipo_finca"]
        }
        Update: {
          actualizado_en?: string
          codigo?: string
          coeficiente?: number
          comunidad_id?: string
          creado_en?: string
          id?: string
          metros_cuadrados?: number | null
          notas?: string | null
          numero?: number | null
          planta?: string | null
          puerta?: string | null
          tipo?: Database["public"]["Enums"]["tipo_finca"]
        }
        Relationships: [
          {
            foreignKeyName: "fincas_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          base_imponible: number
          categoria_id: string | null
          comunidad_id: string
          concepto: string
          creado_en: string
          creado_por: string | null
          factura_url: string | null
          fecha: string
          id: string
          iva: number
          pagado: boolean
          pagado_en: string | null
          proveedor_id: string | null
          total: number
        }
        Insert: {
          base_imponible?: number
          categoria_id?: string | null
          comunidad_id: string
          concepto: string
          creado_en?: string
          creado_por?: string | null
          factura_url?: string | null
          fecha?: string
          id?: string
          iva?: number
          pagado?: boolean
          pagado_en?: string | null
          proveedor_id?: string | null
          total?: number
        }
        Update: {
          base_imponible?: number
          categoria_id?: string | null
          comunidad_id?: string
          concepto?: string
          creado_en?: string
          creado_por?: string | null
          factura_url?: string | null
          fecha?: string
          id?: string
          iva?: number
          pagado?: boolean
          pagado_en?: string | null
          proveedor_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencias: {
        Row: {
          comunidad_id: string
          coste: number | null
          creado_en: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_incidencia"]
          finca_id: string | null
          id: string
          prioridad: Database["public"]["Enums"]["prioridad_incidencia"]
          proveedor_id: string | null
          reportado_por: string | null
          resuelto_en: string | null
          tipo: Database["public"]["Enums"]["tipo_incidencia"]
          titulo: string
          ubicacion: string | null
        }
        Insert: {
          comunidad_id: string
          coste?: number | null
          creado_en?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_incidencia"]
          finca_id?: string | null
          id?: string
          prioridad?: Database["public"]["Enums"]["prioridad_incidencia"]
          proveedor_id?: string | null
          reportado_por?: string | null
          resuelto_en?: string | null
          tipo?: Database["public"]["Enums"]["tipo_incidencia"]
          titulo: string
          ubicacion?: string | null
        }
        Update: {
          comunidad_id?: string
          coste?: number | null
          creado_en?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_incidencia"]
          finca_id?: string | null
          id?: string
          prioridad?: Database["public"]["Enums"]["prioridad_incidencia"]
          proveedor_id?: string | null
          reportado_por?: string | null
          resuelto_en?: string | null
          tipo?: Database["public"]["Enums"]["tipo_incidencia"]
          titulo?: string
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos: {
        Row: {
          categoria_id: string | null
          comunidad_id: string
          concepto: string
          creado_en: string
          creado_por: string | null
          fecha: string
          id: string
          importe: number
        }
        Insert: {
          categoria_id?: string | null
          comunidad_id: string
          concepto: string
          creado_en?: string
          creado_por?: string | null
          fecha?: string
          id?: string
          importe: number
        }
        Update: {
          categoria_id?: string | null
          comunidad_id?: string
          concepto?: string
          creado_en?: string
          creado_por?: string | null
          fecha?: string
          id?: string
          importe?: number
        }
        Relationships: []
      }
      invitaciones: {
        Row: {
          aceptada_en: string | null
          caduca_en: string
          comunidad_id: string
          correo: string
          creada_por: string | null
          creado_en: string
          finca_id: string | null
          id: string
          rol: Database["public"]["Enums"]["rol_miembro"]
          token: string
        }
        Insert: {
          aceptada_en?: string | null
          caduca_en?: string
          comunidad_id: string
          correo: string
          creada_por?: string | null
          creado_en?: string
          finca_id?: string | null
          id?: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          token?: string
        }
        Update: {
          aceptada_en?: string | null
          caduca_en?: string
          comunidad_id?: string
          correo?: string
          creada_por?: string | null
          creado_en?: string
          finca_id?: string | null
          id?: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_creada_por_fkey"
            columns: ["creada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      juntas: {
        Row: {
          acta_aprobada_en: string | null
          acta_documento_id: string | null
          acta_notificada_en: string | null
          acta_texto: string | null
          celebrada_en: string | null
          comunidad_id: string
          convocatoria_anuncio_id: string | null
          convocatoria_enviada_en: string | null
          convocatoria_medios: string[]
          creada_por: string | null
          creado_en: string
          estado: Database["public"]["Enums"]["estado_junta"]
          fecha_hora: string
          id: string
          lugar: string | null
          notas: string | null
          segunda_convocatoria_minutos: number
          tipo: Database["public"]["Enums"]["tipo_junta"]
          titulo: string
        }
        Insert: {
          acta_aprobada_en?: string | null
          acta_documento_id?: string | null
          acta_notificada_en?: string | null
          acta_texto?: string | null
          celebrada_en?: string | null
          comunidad_id: string
          convocatoria_anuncio_id?: string | null
          convocatoria_enviada_en?: string | null
          convocatoria_medios?: string[]
          creada_por?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_junta"]
          fecha_hora: string
          id?: string
          lugar?: string | null
          notas?: string | null
          segunda_convocatoria_minutos?: number
          tipo?: Database["public"]["Enums"]["tipo_junta"]
          titulo: string
        }
        Update: {
          acta_aprobada_en?: string | null
          acta_documento_id?: string | null
          acta_notificada_en?: string | null
          acta_texto?: string | null
          celebrada_en?: string | null
          comunidad_id?: string
          convocatoria_anuncio_id?: string | null
          convocatoria_enviada_en?: string | null
          convocatoria_medios?: string[]
          creada_por?: string | null
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_junta"]
          fecha_hora?: string
          id?: string
          lugar?: string | null
          notas?: string | null
          segunda_convocatoria_minutos?: number
          tipo?: Database["public"]["Enums"]["tipo_junta"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "juntas_acta_documento_id_fkey"
            columns: ["acta_documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "juntas_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "juntas_creada_por_fkey"
            columns: ["creada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lecturas_anuncio: {
        Row: {
          anuncio_id: string
          leido_en: string
          usuario_id: string
        }
        Insert: {
          anuncio_id: string
          leido_en?: string
          usuario_id: string
        }
        Update: {
          anuncio_id?: string
          leido_en?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lecturas_anuncio_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecturas_anuncio_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros: {
        Row: {
          comunidad_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_miembro"]
          finca_principal_id: string | null
          id: string
          rol: Database["public"]["Enums"]["rol_miembro"]
          usuario_id: string
        }
        Insert: {
          comunidad_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_miembro"]
          finca_principal_id?: string | null
          id?: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          usuario_id: string
        }
        Update: {
          comunidad_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_miembro"]
          finca_principal_id?: string | null
          id?: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miembros_finca_principal_id_fkey"
            columns: ["finca_principal_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miembros_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_fondo: {
        Row: {
          comunidad_id: string
          concepto: string
          creado_en: string
          creado_por: string | null
          fecha: string
          id: string
          importe: number
          tipo: Database["public"]["Enums"]["tipo_movimiento_fondo"]
        }
        Insert: {
          comunidad_id: string
          concepto: string
          creado_en?: string
          creado_por?: string | null
          fecha?: string
          id?: string
          importe: number
          tipo: Database["public"]["Enums"]["tipo_movimiento_fondo"]
        }
        Update: {
          comunidad_id?: string
          concepto?: string
          creado_en?: string
          creado_por?: string | null
          fecha?: string
          id?: string
          importe?: number
          tipo?: Database["public"]["Enums"]["tipo_movimiento_fondo"]
        }
        Relationships: []
      }
      notificaciones: {
        Row: {
          comunidad_id: string | null
          creado_en: string
          cuerpo: string | null
          correo_enviado_en: string | null
          correo_error: string | null
          id: string
          leida_en: string | null
          tipo: string
          titulo: string
          url: string | null
          usuario_id: string
        }
        Insert: {
          comunidad_id?: string | null
          creado_en?: string
          cuerpo?: string | null
          correo_enviado_en?: string | null
          correo_error?: string | null
          id?: string
          leida_en?: string | null
          tipo?: string
          titulo: string
          url?: string | null
          usuario_id: string
        }
        Update: {
          comunidad_id?: string | null
          creado_en?: string
          cuerpo?: string | null
          correo_enviado_en?: string | null
          correo_error?: string | null
          id?: string
          leida_en?: string | null
          tipo?: string
          titulo?: string
          url?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          creado_en: string
          fecha: string
          id: string
          importe: number
          metodo: string | null
          recibo_id: string
          referencia: string | null
          registrado_por: string | null
        }
        Insert: {
          creado_en?: string
          fecha?: string
          id?: string
          importe: number
          metodo?: string | null
          recibo_id: string
          referencia?: string | null
          registrado_por?: string | null
        }
        Update: {
          creado_en?: string
          fecha?: string
          id?: string
          importe?: number
          metodo?: string | null
          recibo_id?: string
          referencia?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: false
            referencedRelation: "recibos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partidas_presupuesto: {
        Row: {
          categoria_id: string | null
          concepto: string
          creado_en: string
          id: string
          importe: number
          presupuesto_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          categoria_id?: string | null
          concepto: string
          creado_en?: string
          id?: string
          importe: number
          presupuesto_id: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          categoria_id?: string | null
          concepto?: string
          creado_en?: string
          id?: string
          importe?: number
          presupuesto_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "partidas_presupuesto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_presupuesto_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          actualizado_en: string
          apellidos: string | null
          avatar_url: string | null
          avisos_correo: boolean
          domicilio_notificaciones: string | null
          correo: string | null
          creado_en: string
          es_admin_plataforma: boolean
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string
          apellidos?: string | null
          avatar_url?: string | null
          avisos_correo?: boolean
          domicilio_notificaciones?: string | null
          correo?: string | null
          creado_en?: string
          es_admin_plataforma?: boolean
          id: string
          nombre?: string
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string
          apellidos?: string | null
          avatar_url?: string | null
          avisos_correo?: boolean
          domicilio_notificaciones?: string | null
          correo?: string | null
          creado_en?: string
          es_admin_plataforma?: boolean
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      presupuestos: {
        Row: {
          aprobado_en: string | null
          comunidad_id: string
          creado_en: string
          ejercicio: number
          estado: Database["public"]["Enums"]["estado_presupuesto"]
          id: string
          notas: string | null
          total_gastos: number
          total_ingresos: number
        }
        Insert: {
          aprobado_en?: string | null
          comunidad_id: string
          creado_en?: string
          ejercicio: number
          estado?: Database["public"]["Enums"]["estado_presupuesto"]
          id?: string
          notas?: string | null
          total_gastos?: number
          total_ingresos?: number
        }
        Update: {
          aprobado_en?: string | null
          comunidad_id?: string
          creado_en?: string
          ejercicio?: number
          estado?: Database["public"]["Enums"]["estado_presupuesto"]
          id?: string
          notas?: string | null
          total_gastos?: number
          total_ingresos?: number
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          categoria: string | null
          cif: string | null
          comunidad_id: string
          contrato_fin: string | null
          contrato_inicio: string | null
          correo: string | null
          creado_en: string
          id: string
          nombre: string
          notas: string | null
          persona_contacto: string | null
          seguro_hasta: string | null
          telefono: string | null
        }
        Insert: {
          categoria?: string | null
          cif?: string | null
          comunidad_id: string
          contrato_fin?: string | null
          contrato_inicio?: string | null
          correo?: string | null
          creado_en?: string
          id?: string
          nombre: string
          notas?: string | null
          persona_contacto?: string | null
          seguro_hasta?: string | null
          telefono?: string | null
        }
        Update: {
          categoria?: string | null
          cif?: string | null
          comunidad_id?: string
          contrato_fin?: string | null
          contrato_inicio?: string | null
          correo?: string | null
          creado_en?: string
          id?: string
          nombre?: string
          notas?: string | null
          persona_contacto?: string | null
          seguro_hasta?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      puntos_del_dia: {
        Row: {
          creado_en: string
          descripcion: string | null
          id: string
          junta_id: string
          mayoria_requerida: Database["public"]["Enums"]["mayoria_requerida"]
          posicion: number
          abstenciones: number | null
          resultado: string | null
          votos_contra: number | null
          votos_favor: number | null
          tipo: Database["public"]["Enums"]["tipo_punto"]
          titulo: string
        }
        Insert: {
          creado_en?: string
          descripcion?: string | null
          id?: string
          junta_id: string
          mayoria_requerida?: Database["public"]["Enums"]["mayoria_requerida"]
          posicion?: number
          abstenciones?: number | null
          resultado?: string | null
          votos_contra?: number | null
          votos_favor?: number | null
          tipo?: Database["public"]["Enums"]["tipo_punto"]
          titulo: string
        }
        Update: {
          creado_en?: string
          descripcion?: string | null
          id?: string
          junta_id?: string
          mayoria_requerida?: Database["public"]["Enums"]["mayoria_requerida"]
          posicion?: number
          abstenciones?: number | null
          resultado?: string | null
          votos_contra?: number | null
          votos_favor?: number | null
          tipo?: Database["public"]["Enums"]["tipo_punto"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "puntos_del_dia_junta_id_fkey"
            columns: ["junta_id"]
            isOneToOne: false
            referencedRelation: "juntas"
            referencedColumns: ["id"]
          },
        ]
      }
      recibos: {
        Row: {
          comunidad_id: string
          concepto: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_recibo"]
          finca_id: string
          id: string
          importe: number
          notas: string | null
          pagado_en: string | null
          periodo: string
          vence_en: string | null
        }
        Insert: {
          comunidad_id: string
          concepto?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_recibo"]
          finca_id: string
          id?: string
          importe: number
          notas?: string | null
          pagado_en?: string | null
          periodo: string
          vence_en?: string | null
        }
        Update: {
          comunidad_id?: string
          concepto?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_recibo"]
          finca_id?: string
          id?: string
          importe?: number
          notas?: string | null
          pagado_en?: string | null
          periodo?: string
          vence_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recibos_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          comunidad_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_reserva"]
          fin: string
          finca_id: string | null
          id: string
          inicio: string
          notas: string | null
          usuario_id: string
          zona_id: string
        }
        Insert: {
          comunidad_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_reserva"]
          fin: string
          finca_id?: string | null
          id?: string
          inicio: string
          notas?: string | null
          usuario_id: string
          zona_id: string
        }
        Update: {
          comunidad_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_reserva"]
          fin?: string
          finca_id?: string | null
          id?: string
          inicio?: string
          notas?: string | null
          usuario_id?: string
          zona_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas_comunes"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          actualizado_en: string
          administra_comunidad: boolean
          clave: string
          descripcion: string | null
          es_admin_plataforma: boolean
          gestiona_documentos: boolean
          gestiona_incidencias: boolean
          gestiona_vecinos: boolean
          nombre: string
          orden: number
          ver_finanzas: boolean
        }
        Insert: {
          actualizado_en?: string
          administra_comunidad?: boolean
          clave: string
          descripcion?: string | null
          es_admin_plataforma?: boolean
          gestiona_documentos?: boolean
          gestiona_incidencias?: boolean
          gestiona_vecinos?: boolean
          nombre: string
          orden?: number
          ver_finanzas?: boolean
        }
        Update: {
          actualizado_en?: string
          administra_comunidad?: boolean
          clave?: string
          descripcion?: string | null
          es_admin_plataforma?: boolean
          gestiona_documentos?: boolean
          gestiona_incidencias?: boolean
          gestiona_vecinos?: boolean
          nombre?: string
          orden?: number
          ver_finanzas?: boolean
        }
        Relationships: []
      }
      seguimientos_incidencia: {
        Row: {
          autor_id: string | null
          creado_en: string
          estado_nuevo: Database["public"]["Enums"]["estado_incidencia"] | null
          id: string
          incidencia_id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          creado_en?: string
          estado_nuevo?: Database["public"]["Enums"]["estado_incidencia"] | null
          id?: string
          incidencia_id: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          creado_en?: string
          estado_nuevo?: Database["public"]["Enums"]["estado_incidencia"] | null
          id?: string
          incidencia_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguimientos_incidencia_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguimientos_incidencia_incidencia_id_fkey"
            columns: ["incidencia_id"]
            isOneToOne: false
            referencedRelation: "incidencias"
            referencedColumns: ["id"]
          },
        ]
      }
      titulares: {
        Row: {
          creado_en: string
          desde: string
          finca_id: string
          hasta: string | null
          id: string
          nombre: string | null
          porcentaje: number
          tipo: Database["public"]["Enums"]["tipo_titular"]
          usuario_id: string | null
        }
        Insert: {
          creado_en?: string
          desde?: string
          finca_id: string
          hasta?: string | null
          id?: string
          nombre?: string | null
          porcentaje?: number
          tipo?: Database["public"]["Enums"]["tipo_titular"]
          usuario_id?: string | null
        }
        Update: {
          creado_en?: string
          desde?: string
          finca_id?: string
          hasta?: string | null
          id?: string
          nombre?: string | null
          porcentaje?: number
          tipo?: Database["public"]["Enums"]["tipo_titular"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "titulares_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titulares_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votos: {
        Row: {
          coeficiente: number
          ausente: boolean
          creado_en: string
          emitido_por: string | null
          finca_id: string
          id: string
          punto_id: string
          sentido: Database["public"]["Enums"]["sentido_voto"]
        }
        Insert: {
          coeficiente?: number
          ausente?: boolean
          creado_en?: string
          emitido_por?: string | null
          finca_id: string
          id?: string
          punto_id: string
          sentido: Database["public"]["Enums"]["sentido_voto"]
        }
        Update: {
          coeficiente?: number
          ausente?: boolean
          creado_en?: string
          emitido_por?: string | null
          finca_id?: string
          id?: string
          punto_id?: string
          sentido?: Database["public"]["Enums"]["sentido_voto"]
        }
        Relationships: [
          {
            foreignKeyName: "votos_emitido_por_fkey"
            columns: ["emitido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votos_finca_id_fkey"
            columns: ["finca_id"]
            isOneToOne: false
            referencedRelation: "fincas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votos_punto_id_fkey"
            columns: ["punto_id"]
            isOneToOne: false
            referencedRelation: "puntos_del_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      zonas_comunes: {
        Row: {
          activa: boolean
          aforo: number | null
          comunidad_id: string
          creado_en: string
          descripcion: string | null
          id: string
          nombre: string
          normas: string | null
          requiere_aprobacion: boolean
        }
        Insert: {
          activa?: boolean
          aforo?: number | null
          comunidad_id: string
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre: string
          normas?: string | null
          requiere_aprobacion?: boolean
        }
        Update: {
          activa?: boolean
          aforo?: number | null
          comunidad_id?: string
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          normas?: string | null
          requiere_aprobacion?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "zonas_comunes_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      comparte_comunidad: { Args: { p_usuario_id: string }; Returns: boolean }
      cobros_por_mes: {
        Args: { p_comunidad_id: string; p_desde: string; p_hasta: string }
        Returns: { mes: string; total: number }[]
      }
      configurar_fincas: {
        Args: {
          p_casas: number
          p_comunidad_id: string
          p_pisos: number
          p_repartir?: boolean
        }
        Returns: Json
      }
      devolver_recibo: {
        Args: { p_nota?: string; p_recibo_id: string }
        Returns: undefined
      }
      es_admin_plataforma: { Args: never; Returns: boolean }
      es_administrador: { Args: { p_comunidad_id: string }; Returns: boolean }
      es_miembro: { Args: { p_comunidad_id: string }; Returns: boolean }
      es_titular_de: { Args: { p_finca_id: string }; Returns: boolean }
      generar_recibos: {
        Args: {
          p_comunidad_id: string
          p_concepto: string
          p_importe_total: number
          p_periodo: string
          p_vence_en?: string
        }
        Returns: Json
      }
      guardar_coeficientes: {
        Args: { p_coeficientes: Json; p_comunidad_id: string }
        Returns: Json
      }
      morosos_junta: {
        Args: { p_junta_id: string }
        Returns: { codigo: string; desde: string; deuda: number; finca_id: string }[]
      }
      puede_editar_finanzas: { Args: { p_comunidad_id: string }; Returns: boolean }
      puede_gestionar_documentos: {
        Args: { p_comunidad_id: string }
        Returns: boolean
      }
      puede_gestionar_incidencias: {
        Args: { p_comunidad_id: string }
        Returns: boolean
      }
      puede_gestionar_vecinos: {
        Args: { p_comunidad_id: string }
        Returns: boolean
      }
      puede_ver_finanzas: { Args: { p_comunidad_id: string }; Returns: boolean }
      tiene_rol: {
        Args: {
          p_comunidad_id: string
          p_roles: Database["public"]["Enums"]["rol_miembro"][]
        }
        Returns: boolean
      }
    }
    Enums: {
      estado_acuerdo: "vigente" | "cumplido" | "archivado"
      estado_incidencia: "abierta" | "en_curso" | "resuelta" | "cerrada"
      estado_junta: "borrador" | "convocada" | "celebrada" | "cerrada"
      estado_miembro: "invitado" | "activo" | "inactivo"
      estado_presupuesto: "borrador" | "aprobado" | "cerrado"
      estado_recibo:
        | "pendiente"
        | "pagado"
        | "devuelto"
        | "aplazado"
        | "anulado"
      estado_reserva: "pendiente" | "aprobada" | "rechazada" | "cancelada"
      mayoria_requerida: "simple" | "doble" | "tres_quintos" | "unanimidad"
      modo_asistencia: "presencial" | "representado" | "ausente"
      prioridad_incidencia: "baja" | "media" | "alta" | "urgente"
      rol_miembro:
        | "presidente"
        | "vicepresidente"
        | "secretario"
        | "vocal"
        | "propietario"
        | "inquilino"
        | "administrador_fincas"
        | "vecino"
      sentido_voto: "favor" | "contra" | "abstencion"
      tipo_finca:
        | "vivienda"
        | "local"
        | "garaje"
        | "trastero"
        | "otro"
        | "casa"
        | "piso"
      tipo_incidencia:
        | "fontaneria"
        | "electricidad"
        | "ascensor"
        | "limpieza"
        | "obra"
        | "ruido"
        | "zonas_comunes"
        | "otro"
      tipo_junta: "ordinaria" | "extraordinaria"
      tipo_movimiento: "ingreso" | "gasto"
      tipo_movimiento_fondo: "dotacion" | "disposicion"
      tipo_punto: "informativo" | "acuerdo" | "votacion"
      tipo_titular: "propietario" | "inquilino" | "familiar"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_acuerdo: ["vigente", "cumplido", "archivado"],
      estado_incidencia: ["abierta", "en_curso", "resuelta", "cerrada"],
      estado_junta: ["borrador", "convocada", "celebrada", "cerrada"],
      estado_miembro: ["invitado", "activo", "inactivo"],
      estado_presupuesto: ["borrador", "aprobado", "cerrado"],
      estado_recibo: ["pendiente", "pagado", "devuelto", "aplazado", "anulado"],
      estado_reserva: ["pendiente", "aprobada", "rechazada", "cancelada"],
      mayoria_requerida: ["simple", "doble", "tres_quintos", "unanimidad"],
      modo_asistencia: ["presencial", "representado", "ausente"],
      prioridad_incidencia: ["baja", "media", "alta", "urgente"],
      rol_miembro: [
        "presidente",
        "vicepresidente",
        "secretario",
        "vocal",
        "propietario",
        "inquilino",
        "administrador_fincas",
        "vecino",
      ],
      sentido_voto: ["favor", "contra", "abstencion"],
      tipo_finca: [
        "vivienda",
        "local",
        "garaje",
        "trastero",
        "otro",
        "casa",
        "piso",
      ],
      tipo_incidencia: [
        "fontaneria",
        "electricidad",
        "ascensor",
        "limpieza",
        "obra",
        "ruido",
        "zonas_comunes",
        "otro",
      ],
      tipo_junta: ["ordinaria", "extraordinaria"],
      tipo_movimiento: ["ingreso", "gasto"],
      tipo_movimiento_fondo: ["dotacion", "disposicion"],
      tipo_punto: ["informativo", "acuerdo", "votacion"],
      tipo_titular: ["propietario", "inquilino", "familiar"],
    },
  },
} as const
