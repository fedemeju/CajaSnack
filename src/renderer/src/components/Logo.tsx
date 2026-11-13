/**
 * Logo de la marca, hecho con HTML/CSS (no es una imagen): se ve nítido en
 * cualquier tamaño y toma los colores del tema claro/oscuro automáticamente.
 *
 *   [CS]  Caja Snack
 *         BOWLING
 */

/** Solo el ícono: cuadrado azul redondeado con "CS". */
export function LogoMarca({ className }: { className?: string }): JSX.Element {
  return (
    <span className={`logo-marca ${className ?? ''}`} role="img" aria-label="Caja Snack">
      CS
    </span>
  )
}

/**
 * Logo horizontal (ícono + nombre). Si `fondoClaro` es true (ej. una tarjeta
 * siempre blanca como el login), usa colores oscuros sin importar el tema.
 */
export function Logo({
  className,
  fondoClaro
}: {
  className?: string
  fondoClaro?: boolean
}): JSX.Element {
  return (
    <span className={`logo ${fondoClaro ? 'logo-fondo-claro' : ''} ${className ?? ''}`}>
      <LogoMarca />
      <span className="logo-texto" aria-hidden>
        <span className="logo-nombre">
          Caja <span className="logo-snack">Snack</span>
        </span>
        <span className="logo-sub">Bowling</span>
      </span>
    </span>
  )
}
