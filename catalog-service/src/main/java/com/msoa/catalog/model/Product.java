package com.msoa.catalog.model;

import java.math.BigDecimal;

public record Product(
        Long id,
        String name,
        String category,
        BigDecimal price,
        String image,
        String description
) {}
